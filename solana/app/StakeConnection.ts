import {
  AnchorProvider,
  Idl,
  IdlAccounts,
  Program,
  utils,
  Wallet,
} from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import * as importedWasm from "@wormhole/staking-wasm";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import BN from "bn.js";
import { Staking } from "../target/types/staking";
import IDL from "../target/idl/staking.json";
import { WHTokenBalance } from "./whTokenBalance";
import { contracts } from "@wormhole-foundation/sdk-base";
import {
  PriorityFeeConfig,
  sendTransactions,
  TransactionBuilder,
} from "./transaction";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { CheckpointAccount, readCheckpoints } from "./checkpoints";
import {
  WindowLengthsAccount,
  readWindowLengths,
} from "./vote_weight_window_lengths";
import { signaturesToSolanaArray } from "@wormhole-foundation/wormhole-query-sdk";
import { deriveGuardianSetKey } from "./helpers/guardianSet";
import crypto from "crypto";

let wasm = importedWasm;
export { wasm };

export type GlobalConfig = IdlAccounts<Staking>["globalConfig"];
export type CheckpointData = IdlAccounts<Staking>["checkpointData"];
export type StakeAccountMetadata = IdlAccounts<Staking>["stakeAccountMetadata"];

/** This is the main class that provides an interface to interact with the staking program. */
export class StakeConnection {
  program: Program<Staking>;
  provider: AnchorProvider;
  config: GlobalConfig;
  configAddress: PublicKey;
  addressLookupTable: PublicKey | undefined;
  priorityFeeConfig: PriorityFeeConfig;

  private constructor(
    program: Program<Staking>,
    provider: AnchorProvider,
    config: GlobalConfig,
    configAddress: PublicKey,
    addressLookupTable: PublicKey | undefined,
    priorityFeeConfig: PriorityFeeConfig | undefined,
  ) {
    this.program = program;
    this.provider = provider;
    this.config = config;
    this.configAddress = configAddress;
    this.addressLookupTable = addressLookupTable;
    this.priorityFeeConfig = priorityFeeConfig ?? {};
  }

  /** Confirms the transaction with the given signature by checking its inclusion in the latest block. */
  private async confirm(signature: string): Promise<string> {
    const block = await this.provider.connection.getLatestBlockhash();
    await this.provider.connection.confirmTransaction({
      signature,
      ...block,
    });

    return signature;
  }

  /** Establishes a connection to the staking program using the provided connection and wallet. */
  public static async connect(
    connection: Connection,
    wallet: Wallet,
  ): Promise<StakeConnection> {
    return await StakeConnection.createStakeConnection(connection, wallet);
  }

  /** Creates a program connection and loads the staking config
   *  the constructor cannot be async so we use a static method.
   */
  public static async createStakeConnection(
    connection: Connection,
    wallet: Wallet,
    addressLookupTable?: PublicKey,
    priorityFeeConfig?: PriorityFeeConfig,
  ): Promise<StakeConnection> {
    const provider = new AnchorProvider(connection, wallet, {});
    const program = new Program(
      IDL as Idl,
      provider,
    ) as unknown as Program<Staking>;
    // Sometimes in the browser, the import returns a promise.
    // Don't fully understand, but this workaround is not terrible
    if (wasm.hasOwnProperty("default")) {
      wasm = await (wasm as any).default;
    }

    const configAddress = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode(wasm.Constants.CONFIG_SEED())],
      program.programId,
    )[0];

    const config = await program.account.globalConfig.fetch(configAddress);

    return new StakeConnection(
      program,
      provider,
      config,
      configAddress,
      addressLookupTable,
      priorityFeeConfig,
    );
  }

  /** Sends and confirms a batch of instructions as versioned transactions,
   *  handling address lookup tables and priority fees.
   */
  public async sendAndConfirmAsVersionedTransaction(
    instructions: TransactionInstruction[],
  ) {
    const addressLookupTableAccount = this.addressLookupTable
      ? ((
          await this.provider.connection.getAddressLookupTable(
            this.addressLookupTable,
          )
        ).value ?? undefined)
      : undefined;

    const transactions =
      await TransactionBuilder.batchIntoVersionedTransactions(
        this.userPublicKey(),
        this.provider.connection,
        instructions.map((instruction) => {
          return { instruction, signers: [] };
        }),
        this.priorityFeeConfig,
        addressLookupTableAccount,
      );

    return sendTransactions(
      transactions,
      this.provider.connection,
      this.provider.wallet as NodeWallet,
    );
  }

  /** The public key of the user of the staking program.
   *  This connection sends transactions as this user.
   */
  public userPublicKey(): PublicKey {
    return this.provider.wallet.publicKey;
  }

  /** Gets the user's stake account CheckpointData address or undefined if it doesn't exist. */
  public async getStakeAccountCheckpointsAddress(
    user: PublicKey,
    index: number,
  ): Promise<PublicKey | undefined> {
    let checkpointDataAccountPublicKey = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        user.toBuffer(),
        Buffer.from([index, 0]),
      ],
      this.program.programId,
    )[0];

    const accountData = await this.program.account.checkpointData.fetchNullable(
      checkpointDataAccountPublicKey,
    );
    return accountData !== null ? checkpointDataAccountPublicKey : undefined;
  }

  /** Gets the user's stake account CheckpointData address or undefined
   *  if it doesn't exist using user's stake metadata account.
   */
  public async getStakeAccountCheckpointsAddressByMetadata(
    stakeAccountAddress: PublicKey | undefined,
    previous: boolean,
  ): Promise<PublicKey | undefined> {
    if (!stakeAccountAddress) {
      return undefined;
    }

    const account =
      await this.program.account.stakeAccountMetadata.fetch(
        stakeAccountAddress,
      );
    let currentIndex = previous
      ? account.stakeAccountCheckpointsLastIndex - 1
      : account.stakeAccountCheckpointsLastIndex;
    let checkpointDataAccountPublicKey = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        account.owner.toBuffer(),
        Buffer.from([currentIndex, 0]),
      ],
      this.program.programId,
    )[0];

    const accountData = await this.program.account.checkpointData.fetchNullable(
      checkpointDataAccountPublicKey,
    );
    return accountData !== null ? checkpointDataAccountPublicKey : undefined;
  }

  /** Gets the address of the stake metadata account for a given owner,
   *  or returns undefined if the account does not exist.
   */
  public async getStakeMetadataAddress(
    ownerAddress: PublicKey,
  ): Promise<PublicKey | undefined> {
    let stakeMetadataAccount = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.STAKE_ACCOUNT_METADATA_SEED()),
        ownerAddress.toBuffer(),
      ],
      this.program.programId,
    )[0];

    const account =
      await this.program.account.stakeAccountMetadata.fetchNullable(
        stakeMetadataAccount,
      );
    return account !== null ? stakeMetadataAccount : undefined;
  }

  /** Fetches the public key of a proposal account based on the given proposal ID. */
  async fetchProposalAccount(proposalId: Buffer) {
    const proposalAccount = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode(wasm.Constants.PROPOSAL_SEED()), proposalId],
      this.program.programId,
    )[0];

    return { proposalAccount };
  }

  /** Fetches and parses the proposal account data into a Wasm-compatible format based on the given proposal ID. */
  async fetchProposalAccountWasm(proposalId: Buffer) {
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    const inbuf =
      await this.program.provider.connection.getAccountInfo(proposalAccount);

    const proposalAccountWasm = new wasm.WasmProposalData(inbuf!.data);

    return { proposalAccountWasm };
  }

  /** Fetches and returns the proposal account data for the given proposal ID. */
  async fetchProposalAccountData(proposalId: Buffer) {
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    const proposalAccountData =
      await this.program.account.proposalData.fetch(proposalAccount);

    return { proposalAccountData };
  }

  /** Fetches and returns the guardian signatures data for the specified address. */
  async fetchGuardianSignaturesData(address: PublicKey) {
    const guardianSignaturesData =
      await this.program.account.guardianSignatures.fetch(address);

    return { guardianSignaturesData };
  }

  /** Fetches and returns the checkpoint account data for the specified address. */
  async fetchCheckpointAccount(address: PublicKey): Promise<CheckpointAccount> {
    return await readCheckpoints(this.provider.connection, address);
  }

  /** Fetches and returns the window lengths account data for vote weight calculations. */
  async fetchWindowLengthsAccount(): Promise<WindowLengthsAccount> {
    let windowLengthsAccountAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(
          wasm.Constants.VOTE_WEIGHT_WINDOW_LENGTHS_SEED(),
        ),
      ],
      this.program.programId,
    )[0];

    return await readWindowLengths(
      this.provider.connection,
      windowLengthsAccountAddress,
    );
  }

  /** Fetches and returns the stake account metadata for the specified address. */
  public async fetchStakeAccountMetadata(
    address: PublicKey,
  ): Promise<StakeAccountMetadata> {
    const metadataAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.STAKE_ACCOUNT_METADATA_SEED()),
        address.toBuffer(),
      ],
      this.program.programId,
    )[0];

    const fetchedData =
      await this.program.account.stakeAccountMetadata.fetch(metadataAddress);

    return fetchedData as StakeAccountMetadata;
  }

  /** Stake accounts are loaded by a StakeConnection object. */
  public async loadStakeAccount(address: PublicKey): Promise<StakeAccount> {
    const checkpointAccount = await this.fetchCheckpointAccount(address);

    const stakeAccountMetadata = await this.fetchStakeAccountMetadata(
      this.userPublicKey(),
    );

    const custodyAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        this.userPublicKey().toBuffer(),
      ],
      this.program.programId,
    )[0];

    const authorityAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.AUTHORITY_SEED()),
        this.userPublicKey().toBuffer(),
      ],
      this.program.programId,
    )[0];

    const tokenBalance = (
      await getAccount(this.program.provider.connection, custodyAddress)
    ).amount;

    const totalSupply = (
      await getMint(
        this.program.provider.connection,
        this.config.votingTokenMint,
      )
    ).supply;

    return new StakeAccount(
      address,
      checkpointAccount,
      stakeAccountMetadata,
      tokenBalance,
      authorityAddress,
      totalSupply,
      this.config,
    );
  }

  /** Gets the current unix time, as would be perceived by the on-chain program. */
  public async getTime(): Promise<BN> {
    // Using Sysvar clock
    const clockBuf =
      await this.program.provider.connection.getAccountInfo(
        SYSVAR_CLOCK_PUBKEY,
      );
    return new BN(wasm.getUnixTime(clockBuf!.data).toString());
  }

  /** Creates a new stake account and sends the transaction for confirmation. */
  public async createStakeAccount(): Promise<void> {
    const instructions: TransactionInstruction[] = [];
    instructions.push(
      await this.program.methods
        .createStakeAccount()
        .accounts({
          mint: this.config.votingTokenMint,
        })
        .instruction(),
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
  }

  /** Creates a new stake account with the specified owner, and adds the necessary instructions to the transaction. */
  public async withCreateStakeAccount(
    instructions: TransactionInstruction[],
    owner: PublicKey,
  ): Promise<PublicKey> {
    const checkpointDataAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        owner.toBuffer(),
        Buffer.from([0, 0]),
      ],
      this.program.programId,
    )[0];
    instructions.push(
      await this.program.methods
        .createStakeAccount()
        .accounts({
          mint: this.config.votingTokenMint,
        })
        .instruction(),
    );

    return checkpointDataAddress;
  }

  /** Builds a transfer instruction to move tokens from the user's associated token account
   *  to the custody account of the specified stake account address.
   */
  public async buildTransferInstruction(
    stakeAccountCheckpointsAddress: PublicKey,
    amount: BN,
  ): Promise<TransactionInstruction> {
    const from_account = await getAssociatedTokenAddress(
      this.config.votingTokenMint,
      this.provider.wallet.publicKey,
      true,
    );

    const toAccount = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        stakeAccountCheckpointsAddress.toBuffer(),
      ],
      this.program.programId,
    )[0];

    const ix = createTransferInstruction(
      from_account,
      toAccount,
      this.provider.wallet.publicKey,
      amount.toNumber(),
    );

    return ix;
  }

  /** Delegates stake to a specified delegatee, optionally including vesting, and sends the transaction for confirmation.
   *  It handles stake account metadata, checkpoints, and transfers the specified amount if greater than zero.
   */
  public async delegateWithVest(
    delegatee: PublicKey,
    amount: WHTokenBalance,
    include_vest: boolean,
    vestingConfigAccount: PublicKey | null,
  ): Promise<PublicKey> {
    let stakeAccountMetadataAddress = await this.getStakeMetadataAddress(
      this.userPublicKey(),
    );
    let stakeAccountCheckpointsAddress =
      await this.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    let vestingBalanceAccount: PublicKey = null;
    let currentDelegateStakeAccountCheckpointsAddress: PublicKey;
    let currentDelegateStakeAccountOwner: PublicKey;
    let delegateeStakeAccountOwner: PublicKey;
    const instructions: TransactionInstruction[] = [];

    if (!stakeAccountCheckpointsAddress) {
      stakeAccountCheckpointsAddress = await this.withCreateStakeAccount(
        instructions,
        this.userPublicKey(),
      );
      currentDelegateStakeAccountCheckpointsAddress =
        stakeAccountCheckpointsAddress;
      currentDelegateStakeAccountOwner = this.userPublicKey();
    } else {
      currentDelegateStakeAccountOwner = await this.delegates(
        this.userPublicKey(),
      );
      let currentDelegateStakeAccountMetadataAddress =
        await this.getStakeMetadataAddress(currentDelegateStakeAccountOwner);
      currentDelegateStakeAccountCheckpointsAddress =
        await this.getStakeAccountCheckpointsAddressByMetadata(
          currentDelegateStakeAccountMetadataAddress,
          false,
        );
    }

    let delegateeStakeAccountCheckpointsAddress: PublicKey;
    if (delegatee) {
      let delegateeStakeAccountMetadata =
        await this.getStakeMetadataAddress(delegatee);
      delegateeStakeAccountCheckpointsAddress =
        await this.getStakeAccountCheckpointsAddressByMetadata(
          delegateeStakeAccountMetadata,
          false,
        );
      delegateeStakeAccountOwner = delegatee;
    }

    if (!delegateeStakeAccountCheckpointsAddress) {
      delegateeStakeAccountCheckpointsAddress =
        currentDelegateStakeAccountCheckpointsAddress;
      delegateeStakeAccountOwner = currentDelegateStakeAccountOwner;
    }

    if (amount.toBN().gt(new BN(0))) {
      instructions.push(
        await this.buildTransferInstruction(
          this.userPublicKey(),
          amount.toBN(),
        ),
      );
    }

    if (include_vest) {
      vestingBalanceAccount = PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(wasm.Constants.VESTING_BALANCE_SEED()),
          vestingConfigAccount.toBuffer(),
          this.userPublicKey().toBuffer(),
        ],
        this.program.programId,
      )[0];
    }

    instructions.push(
      await this.program.methods
        .delegate(delegateeStakeAccountOwner, currentDelegateStakeAccountOwner)
        .accountsPartial({
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          delegateeStakeAccountCheckpoints:
            delegateeStakeAccountCheckpointsAddress,
          vestingConfig: vestingConfigAccount,
          vestingBalance: vestingBalanceAccount,
          mint: this.config.votingTokenMint,
        })
        .instruction(),
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
    return stakeAccountCheckpointsAddress;
  }

  /** Delegates a specified token amount from the user's stake account to the delegatee's stake account.
   *  If the amount is zero, the delegate will be changed for all already staked tokens.
   *  If the amount is greater than zero, the staked token amount will increase by the specified amount.
   */
  public async delegate(
    delegatee: PublicKey | undefined,
    amount: WHTokenBalance,
  ): Promise<PublicKey> {
    let stakeAccountMetadataAddress = await this.getStakeMetadataAddress(
      this.userPublicKey(),
    );

    let stakeAccountCheckpointsAddress =
      await this.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    let currentDelegateStakeAccountCheckpointsAddress: PublicKey;
    let currentDelegateStakeAccountOwner: PublicKey;
    let delegateeStakeAccountOwner: PublicKey;

    const instructions: TransactionInstruction[] = [];

    if (!stakeAccountCheckpointsAddress) {
      stakeAccountCheckpointsAddress = await this.withCreateStakeAccount(
        instructions,
        this.userPublicKey(),
      );
      currentDelegateStakeAccountCheckpointsAddress =
        stakeAccountCheckpointsAddress;
      currentDelegateStakeAccountOwner = this.userPublicKey();
    } else {
      currentDelegateStakeAccountOwner = await this.delegates(
        this.userPublicKey(),
      );
      let currentDelegateStakeAccountMetadataAddress =
        await this.getStakeMetadataAddress(currentDelegateStakeAccountOwner);
      currentDelegateStakeAccountCheckpointsAddress =
        await this.getStakeAccountCheckpointsAddressByMetadata(
          currentDelegateStakeAccountMetadataAddress,
          false,
        );
    }

    let delegateeStakeAccountCheckpointsAddress: PublicKey;
    if (delegatee) {
      let delegateeStakeAccountMetadata =
        await this.getStakeMetadataAddress(delegatee);
      delegateeStakeAccountCheckpointsAddress =
        await this.getStakeAccountCheckpointsAddressByMetadata(
          delegateeStakeAccountMetadata,
          false,
        );
      delegateeStakeAccountOwner = delegatee;
    }

    if (!delegateeStakeAccountCheckpointsAddress) {
      delegateeStakeAccountCheckpointsAddress =
        currentDelegateStakeAccountCheckpointsAddress;
      delegateeStakeAccountOwner = currentDelegateStakeAccountOwner;
    }

    if (amount.toBN().gt(new BN(0))) {
      instructions.push(
        await this.buildTransferInstruction(
          this.userPublicKey(),
          amount.toBN(),
        ),
      );
    }

    instructions.push(
      await this.program.methods
        .delegate(delegateeStakeAccountOwner, currentDelegateStakeAccountOwner)
        .accountsPartial({
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          delegateeStakeAccountCheckpoints:
            delegateeStakeAccountCheckpointsAddress,
          vestingConfig: null,
          vestingBalance: null,
          mint: this.config.votingTokenMint,
        })
        .instruction(),
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);

    return stakeAccountCheckpointsAddress;
  }

  /** Casts a vote on a proposal using the voter's stake account checkpoint data,
   *  determined dynamically based on the user's public key and the provided checkpoint index.
   *  The function constructs the transaction instructions with the given vote counts
   *  for "against," "for," and "abstain," and submits the transaction for confirmation.
   */
  public async castVote(
    proposalId: Buffer,
    againstVotes: BN,
    forVotes: BN,
    abstainVotes: BN,
    checkpointIndex: number = 0,
  ): Promise<void> {
    let voterStakeAccountCheckpointsAddress =
      await this.getStakeAccountCheckpointsAddress(
        this.userPublicKey(),
        checkpointIndex,
      );
    let nextVoterStakeAccountCheckpointsAddress =
      await this.getStakeAccountCheckpointsAddress(
        this.userPublicKey(),
        checkpointIndex + 1,
      );

    const instructions: TransactionInstruction[] = [];
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    instructions.push(
      await this.program.methods
        .castVote(
          Array.from(proposalId),
          againstVotes,
          forVotes,
          abstainVotes,
          checkpointIndex,
        )
        .accountsPartial({
          proposal: proposalAccount,
          voterCheckpoints: voterStakeAccountCheckpointsAddress,
          voterCheckpointsNext:
            nextVoterStakeAccountCheckpointsAddress == undefined
              ? null
              : nextVoterStakeAccountCheckpointsAddress,
        })
        .instruction(),
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
  }

  /** Retrieves the current voting results (against, for, and abstain votes) for the specified proposal id. */
  public async proposalVotes(proposalId: Buffer): Promise<{
    proposalId: Buffer;
    againstVotes: BN;
    forVotes: BN;
    abstainVotes: BN;
  }> {
    const { proposalAccountWasm } =
      await this.fetchProposalAccountWasm(proposalId);

    const proposalData = proposalAccountWasm.proposalVotes();

    return {
      proposalId: Buffer.from(proposalData.proposal_id.toBytes()),
      againstVotes: new BN(proposalData.against_votes.toString()),
      forVotes: new BN(proposalData.for_votes.toString()),
      abstainVotes: new BN(proposalData.abstain_votes.toString()),
    };
  }

  /** Posts a set of signatures to the program and returns the associated guardian signatures PDA. */
  public async postSignatures(querySignatures: string[]): Promise<PublicKey> {
    const signatureData = signaturesToSolanaArray(querySignatures);
    const randomSeed = crypto.randomBytes(32);

    await this.program.methods
      .postSignatures(
        signatureData,
        signatureData.length,
        Array.from(randomSeed),
      )
      .accounts({ payer: this.userPublicKey() })
      .rpc();

    const [guardianSignaturesPda] = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.GUARDIAN_SIGNATURES_SEED()),
        this.userPublicKey().toBuffer(),
        randomSeed,
      ],
      this.program.programId,
    );

    return guardianSignaturesPda;
  }

  /** Adds a proposal with the given details, including the guardian signatures and set index,
   *  and sends the transaction for confirmation, either optimized or unoptimized.
   */
  public async addProposal(
    proposalId: Buffer,
    ethProposalResponseBytes: Uint8Array,
    guardianSignatures: PublicKey,
    guardianSetIndex: number,
    unoptimized?: boolean,
  ): Promise<void> {
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);
    const networkType = this.provider.connection.rpcEndpoint.includes("mainnet")
      ? "Mainnet"
      : "Testnet";
    const coreBridge = new PublicKey(
      contracts.coreBridge.get(networkType, "Solana"), // Testnet - 3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5
    );
    const methodsBuilder = this.program.methods
      .addProposal(
        Buffer.from(ethProposalResponseBytes),
        Array.from(proposalId),
        guardianSetIndex,
      )
      .accountsPartial({
        proposal: proposalAccount,
        guardianSignatures: guardianSignatures,
        guardianSet: deriveGuardianSetKey(coreBridge, guardianSetIndex),
      });

    if (unoptimized) {
      await methodsBuilder.rpc().then(this.confirm);
    } else {
      const instructions: TransactionInstruction[] = [];

      instructions.push(await methodsBuilder.instruction());

      await this.sendAndConfirmAsVersionedTransaction(instructions);
    }
  }

  /** Gets the current delegate's public key associated with the user public key. */
  public async delegates(user: PublicKey): Promise<PublicKey> {
    const stakeAccountMetadata = await this.fetchStakeAccountMetadata(user);
    return stakeAccountMetadata.delegate;
  }

  /** Withdraws a specified wormhole token amount from the user's stake account.
   *  The amount of votes will be deducted from the delegate's voting power.
   */
  public async withdrawTokens(
    stakeAccount: StakeAccount,
    amount: WHTokenBalance,
  ) {
    if (amount.toBN().gt(stakeAccount.getBalanceSummary().balance.toBN())) {
      throw new Error("Amount exceeds withdrawable.");
    }

    const toAccount = await getAssociatedTokenAddress(
      this.config.votingTokenMint,
      this.provider.wallet.publicKey,
      true,
    );

    const instructions: TransactionInstruction[] = [];
    if ((await this.provider.connection.getAccountInfo(toAccount)) == null) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          toAccount,
          this.provider.wallet.publicKey,
          this.config.votingTokenMint,
        ),
      );
    }

    let stakeAccountCheckpointsData =
      await this.program.account.checkpointData.fetch(stakeAccount.address);

    let currentDelegateStakeAccountCheckpointsOwner = await this.delegates(
      stakeAccountCheckpointsData.owner,
    );
    let currentDelegateStakeAccountMetadataAddress =
      await this.getStakeMetadataAddress(
        currentDelegateStakeAccountCheckpointsOwner,
      );
    let currentDelegateStakeAccountCheckpointsAddress =
      await this.getStakeAccountCheckpointsAddressByMetadata(
        currentDelegateStakeAccountMetadataAddress,
        false,
      );

    instructions.push(
      await this.program.methods
        .withdrawTokens(
          amount.toBN(),
          currentDelegateStakeAccountCheckpointsOwner,
          stakeAccountCheckpointsData.owner,
        )
        .accountsPartial({
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          destination: toAccount,
        })
        .instruction(),
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
  }
}

export interface BalanceSummary {
  balance: WHTokenBalance;
}

export class StakeAccount {
  address: PublicKey;
  checkpointAccount: CheckpointAccount;
  stakeAccountMetadata: StakeAccountMetadata;
  tokenBalance: bigint;
  authorityAddress: PublicKey;
  totalSupply: bigint;
  config: GlobalConfig;

  constructor(
    address: PublicKey,
    checkpointAccount: any,
    stakeAccountMetadata: StakeAccountMetadata,
    tokenBalance: bigint,
    authorityAddress: PublicKey,
    totalSupply: bigint,
    config: GlobalConfig,
  ) {
    this.address = address;
    this.checkpointAccount = checkpointAccount;
    this.stakeAccountMetadata = stakeAccountMetadata;
    this.tokenBalance = tokenBalance;
    this.authorityAddress = authorityAddress;
    this.totalSupply = totalSupply;
    this.config = config;
  }

  public delegates(): PublicKey {
    return this.stakeAccountMetadata.delegate;
  }

  public getBalanceSummary(): BalanceSummary {
    let balanceBN = new BN(this.tokenBalance.toString());

    return {
      balance: new WHTokenBalance(balanceBN),
    };
  }
}
