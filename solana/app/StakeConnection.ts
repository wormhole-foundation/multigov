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
import { STAKING_ADDRESS, CORE_BRIDGE_ADDRESS } from "./constants";
import {
  PriorityFeeConfig,
  sendTransactions,
  TransactionBuilder,
} from "./transaction";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { CheckpointAccount, readCheckpoints } from "./checkpoints";

import { signaturesToSolanaArray } from "@wormhole-foundation/wormhole-query-sdk";

import { deriveGuardianSetKey } from "./helpers/guardianSet";
import { Keypair } from "@solana/web3.js";

let wasm = importedWasm;
export { wasm };

export type GlobalConfig = IdlAccounts<Staking>["globalConfig"];
export type CheckpointData = IdlAccounts<Staking>["checkpointData"];
export type StakeAccountMetadata = IdlAccounts<Staking>["stakeAccountMetadata"];

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

  private async confirm(signature: string): Promise<string> {
    const block = await this.provider.connection.getLatestBlockhash();
    await this.provider.connection.confirmTransaction({
      signature,
      ...block,
    });

    return signature;
  }

  public static async connect(
    connection: Connection,
    wallet: Wallet,
  ): Promise<StakeConnection> {
    return await StakeConnection.createStakeConnection(
      connection,
      wallet,
      STAKING_ADDRESS,
    );
  }

  /** Creates a program connection and loads the staking config
   *  the constructor cannot be async so we use a static method
   */
  public static async createStakeConnection(
    connection: Connection,
    wallet: Wallet,
    stakingProgramAddress: PublicKey,
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

  private async sendAndConfirmAsVersionedTransaction(
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

  /** The public key of the user of the staking program. This connection sends transactions as this user. */
  public userPublicKey(): PublicKey {
    return this.provider.wallet.publicKey;
  }

  /** Gets the user's stake account CheckpointData address or undefined if it doesn't exist */
  public async getStakeAccountCheckpointsAddress(
    user: PublicKey,
  ): Promise<PublicKey | undefined> {
    let checkpointDataAccountPublicKey = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        user.toBuffer(),
      ],
      this.program.programId,
    )[0];

    const accountData = await this.program.account.checkpointData.fetchNullable(
      checkpointDataAccountPublicKey,
    );
    return accountData !== null ? checkpointDataAccountPublicKey : undefined;
  }

  public async getStakeMetadataAddress(
    checkpointAccount: PublicKey,
  ): Promise<PublicKey | undefined> {
    let stakeMetadataAccount = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.STAKE_ACCOUNT_METADATA_SEED()),
        checkpointAccount.toBuffer(),
      ],
      this.program.programId,
    )[0];

    const account =
      await this.program.account.stakeAccountMetadata.fetchNullable(
        stakeMetadataAccount,
      );
    return account !== null ? stakeMetadataAccount : undefined;
  }

  async fetchProposalAccount(proposalId: Buffer) {
    const proposalAccount = PublicKey.findProgramAddressSync(
      [utils.bytes.utf8.encode(wasm.Constants.PROPOSAL_SEED()), proposalId],
      this.program.programId,
    )[0];

    return { proposalAccount };
  }

  async fetchProposalAccountWasm(proposalId: Buffer) {
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    const inbuf =
      await this.program.provider.connection.getAccountInfo(proposalAccount);

    const proposalAccountWasm = new wasm.WasmProposalData(inbuf!.data);

    return { proposalAccountWasm };
  }

  async fetchProposalAccountData(proposalId: Buffer) {
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    const proposalAccountData =
      await this.program.account.proposalData.fetch(proposalAccount);

    return { proposalAccountData };
  }

  async fetchGuardianSignaturesData(address: PublicKey) {
    const guardianSignaturesData =
      await this.program.account.guardianSignatures.fetch(address);

    return { guardianSignaturesData };
  }

  async fetchCheckpointAccount(address: PublicKey): Promise<CheckpointAccount> {
    return await readCheckpoints(this.provider.connection, address);
  }

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

  /** Stake accounts are loaded by a StakeConnection object */
  public async loadStakeAccount(address: PublicKey): Promise<StakeAccount> {
    const checkpointAccount = await this.fetchCheckpointAccount(address);

    const stakeAccountMetadata = await this.fetchStakeAccountMetadata(address);

    const custodyAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
        address.toBuffer(),
      ],
      this.program.programId,
    )[0];

    const authorityAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.AUTHORITY_SEED()),
        address.toBuffer(),
      ],
      this.program.programId,
    )[0];

    const tokenBalance = (
      await getAccount(this.program.provider.connection, custodyAddress)
    ).amount;

    const totalSupply = (
      await getMint(this.program.provider.connection, this.config.whTokenMint)
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

  /** Gets the current unix time, as would be perceived by the on-chain program */
  public async getTime(): Promise<BN> {
    // This is a hack, we are using this deprecated flag to flag whether we are using the mock clock or not
    if (this.config.freeze) {
      // On chain program using mock clock, so get that time
      const updatedConfig = await this.program.account.globalConfig.fetch(
        this.configAddress,
      );
      return updatedConfig.mockClockTime;
    } else {
      // Using Sysvar clock
      const clockBuf =
        await this.program.provider.connection.getAccountInfo(
          SYSVAR_CLOCK_PUBKEY,
        );
      return new BN(wasm.getUnixTime(clockBuf!.data).toString());
    }
  }

  public async createStakeAccount(): Promise<void> {
    const instructions: TransactionInstruction[] = [];

    const checkpointDataAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        this.userPublicKey().toBuffer(),
      ],
      this.program.programId,
    )[0];

    instructions.push(
      await this.program.methods
        .createStakeAccount(this.userPublicKey())
        .accounts({
          stakeAccountCheckpoints: checkpointDataAddress,
          mint: this.config.whTokenMint,
        })
        .instruction(),
    );
    await this.sendAndConfirmAsVersionedTransaction(instructions);
  }

  public async withCreateAccount(
    instructions: TransactionInstruction[],
    owner: PublicKey,
  ): Promise<PublicKey> {
    const checkpointDataAddress = PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
        owner.toBuffer(),
      ],
      this.program.programId,
    )[0];

    instructions.push(
      await this.program.methods
        .createStakeAccount(owner)
        .accounts({
          stakeAccountCheckpoints: checkpointDataAddress,
          mint: this.config.whTokenMint,
        })
        .instruction(),
    );

    return checkpointDataAddress;
  }

  public async buildTransferInstruction(
    stakeAccountCheckpointsAddress: PublicKey,
    amount: BN,
  ): Promise<TransactionInstruction> {
    const from_account = await getAssociatedTokenAddress(
      this.config.whTokenMint,
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

  public async delegate_with_vest(
    delegatee: PublicKey,
    amount: WHTokenBalance,
    include_vest: boolean,
    vestingConfigAccount: PublicKey | null
  ): Promise<PublicKey> {
    let stakeAccountCheckpointsAddress =
      await this.getStakeAccountCheckpointsAddress(this.userPublicKey());

    let vestingBalanceAccount: PublicKey = null;
    let currentDelegateStakeAccountCheckpointsAddress: PublicKey;
    const instructions: TransactionInstruction[] = [];

    if (!stakeAccountCheckpointsAddress) {
      stakeAccountCheckpointsAddress = await this.withCreateAccount(
        instructions,
        this.userPublicKey(),
      );
      currentDelegateStakeAccountCheckpointsAddress =
        stakeAccountCheckpointsAddress;
    } else {
      currentDelegateStakeAccountCheckpointsAddress = await this.delegates(
        stakeAccountCheckpointsAddress,
      );
    }

    let delegateeStakeAccountCheckpointsAddress: PublicKey;
    if (delegatee) {
      delegateeStakeAccountCheckpointsAddress =
        await this.getStakeAccountCheckpointsAddress(delegatee);
    }

    if (!delegateeStakeAccountCheckpointsAddress) {
      delegateeStakeAccountCheckpointsAddress =
        currentDelegateStakeAccountCheckpointsAddress;
    }

    if (amount.toBN().gt(new BN(0))) {
      instructions.push(
        await this.buildTransferInstruction(
          stakeAccountCheckpointsAddress,
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
        .delegate(delegateeStakeAccountCheckpointsAddress)
        .accounts({
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          delegateeStakeAccountCheckpoints:
            delegateeStakeAccountCheckpointsAddress,
          stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          vestingConfig: vestingConfigAccount,
          vestingBalance: vestingBalanceAccount,
          mint: this.config.whTokenMint,
        })
        .instruction(),
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
    return stakeAccountCheckpointsAddress;
  }

  public async delegate(
    delegatee: PublicKey | undefined,
    amount: WHTokenBalance,
  ): Promise<PublicKey> {
    let stakeAccountCheckpointsAddress =
      await this.getStakeAccountCheckpointsAddress(this.userPublicKey());

    let currentDelegateStakeAccountCheckpointsAddress: PublicKey;
    const instructions: TransactionInstruction[] = [];

    if (!stakeAccountCheckpointsAddress) {
      stakeAccountCheckpointsAddress = await this.withCreateAccount(
        instructions,
        this.userPublicKey(),
      );
      currentDelegateStakeAccountCheckpointsAddress =
        stakeAccountCheckpointsAddress;
    } else {
      currentDelegateStakeAccountCheckpointsAddress = await this.delegates(
        stakeAccountCheckpointsAddress,
      );
    }

    let delegateeStakeAccountCheckpointsAddress: PublicKey;
    if (delegatee) {
      delegateeStakeAccountCheckpointsAddress =
        await this.getStakeAccountCheckpointsAddress(delegatee);
    }

    if (!delegateeStakeAccountCheckpointsAddress) {
      delegateeStakeAccountCheckpointsAddress =
        currentDelegateStakeAccountCheckpointsAddress;
    }

    if (amount.toBN().gt(new BN(0))) {
      instructions.push(
        await this.buildTransferInstruction(
          stakeAccountCheckpointsAddress,
          amount.toBN(),
        ),
      );
    }

    instructions.push(
      await this.program.methods
        .delegate(delegateeStakeAccountCheckpointsAddress)
        .accounts({
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          delegateeStakeAccountCheckpoints:
            delegateeStakeAccountCheckpointsAddress,
          stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          vestingConfig: null,
          vestingBalance: null,
          mint: this.config.whTokenMint,
        })
        .instruction(),
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);

    return stakeAccountCheckpointsAddress;
  }

  public async castVote(
    proposalId: Buffer,
    stakeAccount: PublicKey,
    againstVotes: BN,
    forVotes: BN,
    abstainVotes: BN,
  ): Promise<void> {
    const instructions: TransactionInstruction[] = [];
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    instructions.push(
      await this.program.methods
        .castVote(Array.from(proposalId), againstVotes, forVotes, abstainVotes)
        .accountsPartial({
          proposal: proposalAccount,
          voterCheckpoints: stakeAccount,
        })
        .instruction(),
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
  }

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

  public async isVotingSafe(proposalId: Buffer): Promise<boolean> {
    const { proposalAccountWasm } =
      await this.fetchProposalAccountWasm(proposalId);

    const currentTimestamp = Math.floor(Date.now() / 1000);
    return proposalAccountWasm.isVotingSafe(BigInt(currentTimestamp));
  }

  /** Post signatures */
  public async postSignatures(
    querySignatures: string[],
    signaturesKeypair: Keypair,
  ) {
    const signatureData = signaturesToSolanaArray(querySignatures);
    await this.program.methods
      .postSignatures(signatureData, signatureData.length)
      .accounts({ guardianSignatures: signaturesKeypair.publicKey })
      .signers([signaturesKeypair])
      .rpc();
  }

  public async addProposal(
    proposalId: Buffer,
    ethProposalResponseBytes: Uint8Array,
    guardianSignatures: PublicKey,
    guardianSetIndex: number,
    unoptimized?: boolean,
  ): Promise<void> {
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    const methodsBuilder = this.program.methods
      .addProposal(
        Buffer.from(ethProposalResponseBytes),
        Array.from(proposalId),
        guardianSetIndex,
      )
      .accountsPartial({
        proposal: proposalAccount,
        guardianSignatures: guardianSignatures,
        guardianSet: deriveGuardianSetKey(
          CORE_BRIDGE_ADDRESS,
          guardianSetIndex,
        ),
      });

    if (unoptimized) {
      await methodsBuilder.rpc().then(this.confirm);
    } else {
      const instructions: TransactionInstruction[] = [];

      instructions.push(await methodsBuilder.instruction());

      await this.sendAndConfirmAsVersionedTransaction(instructions);
    }
  }

  /** Gets the current delegate's stake account associated with the specified stake account. */
  public async delegates(stakeAccount: PublicKey): Promise<PublicKey> {
    const stakeAccountMetadata =
      await this.fetchStakeAccountMetadata(stakeAccount);
    return stakeAccountMetadata.delegate;
  }

  /** Withdraws tokens */
  public async withdrawTokens(
    stakeAccount: StakeAccount,
    amount: WHTokenBalance,
  ) {
    if (amount.toBN().gt(stakeAccount.getBalanceSummary().balance.toBN())) {
      throw new Error("Amount exceeds withdrawable.");
    }

    const toAccount = await getAssociatedTokenAddress(
      this.config.whTokenMint,
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
          this.config.whTokenMint,
        ),
      );
    }

    let currentDelegateStakeAccountCheckpointsAddress = await this.delegates(
      stakeAccount.address,
    );

    instructions.push(
      await this.program.methods
        .withdrawTokens(amount.toBN())
        .accounts({
          currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
          stakeAccountCheckpoints: stakeAccount.address,
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
