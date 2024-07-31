import {AnchorProvider, Idl, IdlAccounts, Program, utils, Wallet,} from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Signer,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
  Transaction
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
import {Staking} from "../target/types/staking";
import IDL from "../target/idl/staking.json";
import {WHTokenBalance} from "./whTokenBalance";
import {STAKING_ADDRESS,} from "./constants";
import * as crypto from "crypto";
import {PriorityFeeConfig, sendTransactions, TransactionBuilder,} from "./transaction";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import * as console from "node:console";

let wasm = importedWasm;
export { wasm };

export type GlobalConfig = IdlAccounts<Staking>["globalConfig"];
type CheckpointData = IdlAccounts<Staking>["checkpointData"];
type StakeAccountMetadata = IdlAccounts<Staking>["stakeAccountMetadata"];

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
    priorityFeeConfig: PriorityFeeConfig | undefined
  ) {
    this.program = program;
    this.provider = provider;
    this.config = config;
    this.configAddress = configAddress;
    this.addressLookupTable = addressLookupTable;
    this.priorityFeeConfig = priorityFeeConfig ?? {};
  }

  public static async connect(
    connection: Connection,
    wallet: Wallet
  ): Promise<StakeConnection> {
    return await StakeConnection.createStakeConnection(
      connection,
      wallet,
      STAKING_ADDRESS
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
    priorityFeeConfig?: PriorityFeeConfig
  ): Promise<StakeConnection> {
    const provider = new AnchorProvider(connection, wallet, {});
    const program = new Program(
      IDL as Idl,
      provider
    ) as unknown as Program<Staking>;
    // Sometimes in the browser, the import returns a promise.
    // Don't fully understand, but this workaround is not terrible
    if (wasm.hasOwnProperty("default")) {
      wasm = await (wasm as any).default;
    }

    const configAddress = (
      PublicKey.findProgramAddressSync(
        [utils.bytes.utf8.encode(wasm.Constants.CONFIG_SEED())],
        program.programId
      )
    )[0];

    const config = await program.account.globalConfig.fetch(configAddress);

    return new StakeConnection(
      program,
      provider,
      config,
      configAddress,
      addressLookupTable,
      priorityFeeConfig
    );
  }

  private async sendAndConfirmAsVersionedTransaction(
    instructions: TransactionInstruction[]
  ) {
    const addressLookupTableAccount = this.addressLookupTable
      ? (
          await this.provider.connection.getAddressLookupTable(
            this.addressLookupTable
          )
        ).value
      : undefined;

    const transactions =
      await TransactionBuilder.batchIntoVersionedTransactions(
        this.userPublicKey(),
        this.provider.connection,
        instructions.map((instruction) => {
          return { instruction, signers: [] };
        }),
        this.priorityFeeConfig,
        addressLookupTableAccount
      );

    return sendTransactions(
      transactions,
      this.provider.connection,
      this.provider.wallet as NodeWallet
    );
  }

  /** The public key of the user of the staking program. This connection sends transactions as this user. */
  public userPublicKey(): PublicKey {
    return this.provider.wallet.publicKey;
  }

  public async getAllStakeAccountAddresses(): Promise<PublicKey[]> {
    // Use the raw web3.js connection so that anchor doesn't try to borsh deserialize the zero-copy serialized account
    const allAccts = await this.provider.connection.getProgramAccounts(
      this.program.programId,
      {
        encoding: "base64",
        filters: [
          { memcmp: this.program.coder.accounts.memcmp("checkpointData") },
        ],
      }
    );
    return allAccts.map((acct) => acct.pubkey);
  }

  /** Gets a users stake accounts */
  public async getStakeAccounts(user: PublicKey): Promise<StakeAccount[]> {
    const res = await this.program.provider.connection.getProgramAccounts(
      this.program.programId,
      {
        encoding: "base64",
        filters: [
          {
            memcmp: this.program.coder.accounts.memcmp("checkpointData"),
          },
          {
            memcmp: {
              offset: 8,
              bytes: user.toBase58(),
            },
          },
        ],
      }
    );
    return await Promise.all(
      res.map(async (account) => {
        return await this.loadStakeAccount(account.pubkey);
      })
    );
  }

  /** Gets the user's stake account with the most tokens or undefined if it doesn't exist */
  public async getMainAccount(
    user: PublicKey
  ): Promise<StakeAccount | undefined> {
    const accounts = await this.getStakeAccounts(user);
    if (accounts.length == 0) {
      return undefined;
    } else {
      return accounts.reduce(
        (prev: StakeAccount, curr: StakeAccount): StakeAccount => {
          return prev.tokenBalance > curr.tokenBalance ? curr : prev;
        }
      );
    }
  }

  async fetchProposalAccount(proposalId: BN) {
    const proposalAccount = (
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(wasm.Constants.PROPOSAL_SEED()),
          proposalId.toArrayLike(Buffer, "be", 8)
        ],
        this.program.programId
      )
    )[0];

    return { proposalAccount };
  }

  async fetchProposalAccountWasm(proposalId: BN) {
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    const inbuf =
      await this.program.provider.connection.getAccountInfo(
        proposalAccount
      );

    const proposalAccountWasm = new wasm.WasmProposalData(
      inbuf!.data
    );

    return { proposalAccountWasm };
  }

  async fetchProposalAccountData(proposalId: BN) {
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    const proposalAccountData =
      await this.program.account.proposalData.fetch(proposalAccount);

    return { proposalAccountData };
  }

  async fetchCheckpointAccount(address: PublicKey) {
    const inbuf = await this.program.provider.connection.getAccountInfo(
      address
    );

    const stakeAccountCheckpointsWasm = new wasm.WasmCheckpointData(
      inbuf!.data
    );

    return { stakeAccountCheckpointsWasm };
  }

  public async fetchStakeAccountMetadata(address: PublicKey): Promise<StakeAccountMetadata> {
    const metadataAddress = (
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(wasm.Constants.STAKE_ACCOUNT_METADATA_SEED()),
          address.toBuffer(),
        ],
        this.program.programId
      )
    )[0];

    const fetchedData =
      (await this.program.account.stakeAccountMetadata.fetch(
        metadataAddress
      ));

    return fetchedData as StakeAccountMetadata;
  }

  /** Stake accounts are loaded by a StakeConnection object */
  public async loadStakeAccount(address: PublicKey): Promise<StakeAccount> {
    const { stakeAccountCheckpointsWasm } = await this.fetchCheckpointAccount(
      address
    );

    const stakeAccountMetadata = await this.fetchStakeAccountMetadata(address);

    const custodyAddress = (
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
          address.toBuffer(),
        ],
        this.program.programId
      )
    )[0];

    const authorityAddress = (
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(wasm.Constants.AUTHORITY_SEED()),
          address.toBuffer(),
        ],
        this.program.programId
      )
    )[0];

    const tokenBalance = (await getAccount(
      this.program.provider.connection,
      custodyAddress
    )).amount;

    const totalSupply = (await getMint(
      this.program.provider.connection,
      this.config.whTokenMint
    )).supply

    return new StakeAccount(
      address,
      stakeAccountCheckpointsWasm,
      stakeAccountMetadata,
      tokenBalance,
      authorityAddress,
      totalSupply,
      this.config
    );
  }

  /** Gets the current unix time, as would be perceived by the on-chain program */
  public async getTime(): Promise<BN> {
    // This is a hack, we are using this deprecated flag to flag whether we are using the mock clock or not
    if (this.config.freeze) {
      // On chain program using mock clock, so get that time
      const updatedConfig = await this.program.account.globalConfig.fetch(
        this.configAddress
      );
      return updatedConfig.mockClockTime;
    } else {
      // Using Sysvar clock
      const clockBuf = await this.program.provider.connection.getAccountInfo(
        SYSVAR_CLOCK_PUBKEY
      );
      return new BN(wasm.getUnixTime(clockBuf!.data).toString());
    }
  }

  public async withCreateAccount(
    instructions: TransactionInstruction[],
    owner: PublicKey
  ): Promise<PublicKey> {
    const nonce = crypto.randomBytes(16).toString("hex");
    const stakeAccountAddress = await PublicKey.createWithSeed(
      this.userPublicKey(),
      nonce,
      this.program.programId
    );
//     console.log("nonce:", nonce)
//     console.log("stakeAccountAddress:", stakeAccountAddress)

    instructions.push(
      SystemProgram.createAccountWithSeed({
        fromPubkey: this.userPublicKey(),
        newAccountPubkey: stakeAccountAddress,
        basePubkey: this.userPublicKey(),
        seed: nonce,
        lamports:
          await this.program.provider.connection.getMinimumBalanceForRentExemption(
            wasm.Constants.CHECKPOINT_DATA_SIZE()
          ),
        space: wasm.Constants.CHECKPOINT_DATA_SIZE(),
        programId: this.program.programId,
      })
    );

    instructions.push(
      await this.program.methods
        .createStakeAccount(owner)
        .accounts({
          stakeAccountCheckpoints: stakeAccountAddress,
          mint: this.config.whTokenMint,
        })
        .instruction()
    );

    return stakeAccountAddress;
  }

  public async isLlcMember(stakeAccount: PublicKey) {
    const stakeAccountMetadata = await this.fetchStakeAccountMetadata(stakeAccount);
    return (
      JSON.stringify(stakeAccountMetadata.signedAgreementHash) ==
      JSON.stringify(this.config.agreementHash)
    );
  }

  public async withJoinDaoLlc(
    instructions: TransactionInstruction[],
    stakeAccountAddress: PublicKey
  ) {
    instructions.push(
      await this.program.methods
        .joinDaoLlc(this.config.agreementHash)
        .accounts({
          stakeAccountCheckpoints: stakeAccountAddress,
        })
        .instruction()
    );
  }

  public async buildTransferInstruction(
    stakeAccountCheckpointsAddress: PublicKey,
    amount: BN
  ): Promise<TransactionInstruction> {

    const from_account = await getAssociatedTokenAddress(
      this.config.whTokenMint,
      this.provider.wallet.publicKey,
      true
    );

    const toAccount = (
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
          stakeAccountCheckpointsAddress.toBuffer(),
        ],
        this.program.programId
      )
    )[0];

    const ix = createTransferInstruction(
      from_account,
      toAccount,
      this.provider.wallet.publicKey,
      amount.toNumber()
    );

    return ix;
  }

  public async delegate(
    stakeAccount: PublicKey | undefined,
    delegateeStakeAccount: PublicKey | undefined,
    amount: WHTokenBalance
  ) {
    let currentStakeAccount: PublicKey;
    let currentDelegateStakeAccount: PublicKey;
    const instructions: TransactionInstruction[] = [];

    if (!stakeAccount) {
      currentStakeAccount = await this.withCreateAccount(
        instructions,
        this.provider.wallet.publicKey
      );
      currentDelegateStakeAccount = currentStakeAccount;
    } else {
      currentStakeAccount = stakeAccount;
      currentDelegateStakeAccount = await this.delegates(currentStakeAccount);
    }

    if (!delegateeStakeAccount) {
      delegateeStakeAccount = currentDelegateStakeAccount;
    }

    if (!stakeAccount || !(await this.isLlcMember(stakeAccount))) {
      await this.withJoinDaoLlc(instructions, currentStakeAccount);
    }

    instructions.push(
      await this.buildTransferInstruction(currentStakeAccount, amount.toBN())
    );

    instructions.push(
      await this.program.methods
        .delegate(delegateeStakeAccount)
        .accounts({
          currentDelegateStakeAccountCheckpoints: currentDelegateStakeAccount,
          delegateeStakeAccountCheckpoints: delegateeStakeAccount,
          stakeAccountCheckpoints: currentStakeAccount,
          mint: this.config.whTokenMint,
        })
        .instruction()
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
  }

  public async castVote(
    proposalId: BN,
    stakeAccount: PublicKey,
    againstVotes: BN,
    forVotes: BN,
    abstainVotes: BN,
  ): Promise<void> {
    const instructions: TransactionInstruction[] = [];
    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    instructions.push(
      await this.program.methods
        .castVote(proposalId, againstVotes, forVotes, abstainVotes)
        .accountsPartial({
          proposal: proposalAccount,
          voterCheckpoints: stakeAccount,
        })
        .instruction()
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
  }

  public async proposalVotes(proposalId: BN): Promise<{
    againstVotes: BN;
    forVotes: BN;
    abstainVotes: BN;
  }> {
    const { proposalAccountWasm } = await this.fetchProposalAccountWasm(
      proposalId
    );

    const proposalData = proposalAccountWasm.proposalVotes();

    return {
      againstVotes: new BN(proposalData.against_votes.toString()),
      forVotes: new BN(proposalData.for_votes.toString()),
      abstainVotes: new BN(proposalData.abstain_votes.toString()),
    };
  }

  public async isVotingSafe(proposalId: BN): Promise<boolean> {
    const { proposalAccountWasm } = await this.fetchProposalAccountWasm(
      proposalId
    );

    const currentTimestamp = Math.floor(Date.now() / 1000);
    return proposalAccountWasm.isVotingSafe(BigInt(currentTimestamp));
  }

  public async addProposal(
    proposalId: BN,
    vote_start: BN,
    safe_window: BN,
  ): Promise<void> {
    const instructions: TransactionInstruction[] = [];

    const { proposalAccount } = await this.fetchProposalAccount(proposalId);

    instructions.push(
      await this.program.methods
        .addProposal(proposalId, vote_start, safe_window)
        .accountsPartial({
          proposal: proposalAccount
        })
        .instruction()
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
  }

  /** Gets the current votes balance of the delegate's stake account. */
  public getVotes(delegateStakeAccount: StakeAccount): BN {
    return delegateStakeAccount.getVotes();
  }

  /** Gets the voting power of the delegate's stake account at a specified past timestamp. */
  public getPastVotes(
    delegateStakeAccount: StakeAccount,
    timestamp: BN
  ): BN {
    return delegateStakeAccount.getPastVotes(timestamp);
  }

  /** Gets the current delegate's stake account associated with the specified stake account. */
  public async delegates(stakeAccount: PublicKey): Promise<PublicKey> {
    const stakeAccountMetadata = await this.fetchStakeAccountMetadata(stakeAccount);
    return stakeAccountMetadata.delegate;
  }

  /** Withdraws tokens */
  public async withdrawTokens(stakeAccount: StakeAccount, amount: WHTokenBalance) {
    if (
      amount
        .toBN()
        .gt(
          stakeAccount
            .getBalanceSummary()
            .balance.toBN()
        )
    ) {
      throw new Error("Amount exceeds withdrawable.");
    }

    const toAccount = await getAssociatedTokenAddress(
      this.config.whTokenMint,
      this.provider.wallet.publicKey,
      true
    );

    const instructions: TransactionInstruction[] = [];
    if ((await this.provider.connection.getAccountInfo(toAccount)) == null) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          this.provider.wallet.publicKey,
          toAccount,
          this.provider.wallet.publicKey,
          this.config.whTokenMint
        )
      );
    }

    let currentDelegateStakeAccountAddress = await this.delegates(stakeAccount.address);

    instructions.push(
      await this.program.methods
        .withdrawTokens(amount.toBN())
        .accounts({
          currentDelegateStakeAccountCheckpoints: currentDelegateStakeAccountAddress,
          stakeAccountCheckpoints: stakeAccount.address,
          destination: toAccount,
        })
        .instruction()
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
  }
}

export interface BalanceSummary {
  balance: WHTokenBalance;
}

export class StakeAccount {
  address: PublicKey;
  stakeAccountCheckpointsWasm: any;
  stakeAccountMetadata: StakeAccountMetadata;
  tokenBalance: bigint;
  authorityAddress: PublicKey;
  totalSupply: bigint;
  config: GlobalConfig;

  constructor(
    address: PublicKey,
    stakeAccountCheckpointsWasm: any,
    stakeAccountMetadata: StakeAccountMetadata,
    tokenBalance: bigint,
    authorityAddress: PublicKey,
    totalSupply: bigint,
    config: GlobalConfig
  ) {
    this.address = address;
    this.stakeAccountCheckpointsWasm = stakeAccountCheckpointsWasm;
    this.stakeAccountMetadata = stakeAccountMetadata;
    this.tokenBalance = tokenBalance;
    this.authorityAddress = authorityAddress;
    this.totalSupply = totalSupply;
    this.config = config;
  }

  /** Gets the current votes balance. */
  public getVotes(): BN {
    return new BN(this.stakeAccountCheckpointsWasm.getVoterVotes().toString());
  }

  /** Gets the voting power at a specified past timestamp. */
  public getPastVotes(timestamp: BN): BN {
    const voterVotes =
      this.stakeAccountCheckpointsWasm.getVoterPastVotes(timestamp);

    return new BN(voterVotes.toString());
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
