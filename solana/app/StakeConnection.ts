import {
  Program,
  Wallet,
  utils,
  Idl,
  IdlAccounts,
  AnchorProvider,
} from "@coral-xyz/anchor";
import {
  PublicKey,
  Connection,
  Keypair,
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
  SystemProgram
} from "@solana/web3.js";
import * as wasm2 from "@wormhole/staking-wasm";
import {
  Token,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import BN from "bn.js";
import { Staking } from "../target/types/staking";
import IDL from "../target/idl/staking.json";
import { WHTokenBalance } from "./whTokenBalance";
import {
  getTokenOwnerRecordAddress,
  PROGRAM_VERSION_V2,
  withCreateTokenOwnerRecord,
} from "@solana/spl-governance";
import {
  EPOCH_DURATION,
  GOVERNANCE_ADDRESS,
  STAKING_ADDRESS,
} from "./constants";
import * as crypto from "crypto";
import {
  PriorityFeeConfig,
  TransactionBuilder,
  sendTransactions,
} from "@pythnetwork/solana-utils";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
let wasm = wasm2;
export { wasm };

export type GlobalConfig = IdlAccounts<Staking>["globalConfig"];
type CheckpointData = IdlAccounts<Staking>["checkpointData"];
type StakeAccountMetadata = IdlAccounts<Staking>["stakeAccountMetadata"];

export class StakeConnection {
  program: Program<Staking>;
  provider: AnchorProvider;
  config: GlobalConfig;
  configAddress: PublicKey;
  governanceAddress: PublicKey;
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
    this.governanceAddress = GOVERNANCE_ADDRESS();
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
      stakingProgramAddress,
      provider
    ) as unknown as Program<Staking>;
    // Sometimes in the browser, the import returns a promise.
    // Don't fully understand, but this workaround is not terrible
    if (wasm.hasOwnProperty("default")) {
      wasm = await (wasm as any).default;
    }

    const configAddress = (
      await PublicKey.findProgramAddress(
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
          { memcmp: this.program.coder.accounts.memcmp("CheckpointData") },
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
            memcmp: this.program.coder.accounts.memcmp("CheckpointData"),
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
          return prev.tokenBalance.lt(curr.tokenBalance) ? curr : prev;
        }
      );
    }
  }

  async fetchCheckpointAccount(address: PublicKey) {
    const inbuf = await this.program.provider.connection.getAccountInfo(
      address
    );
    const stakeAccountCheckpointsWasm = new wasm.WasmCheckpointData(inbuf!.data);

    return { stakeAccountCheckpointsWasm };
  }

  /** Stake accounts are loaded by a StakeConnection object */
  public async loadStakeAccount(address: PublicKey): Promise<StakeAccount> {
    const { stakeAccountCheckpointsWasm } =
      await this.fetchCheckpointAccount(address);

    const metadataAddress = (
      await PublicKey.findProgramAddress(
        [
          utils.bytes.utf8.encode(wasm.Constants.STAKE_ACCOUNT_METADATA_SEED()),
          address.toBuffer(),
        ],
        this.program.programId
      )
    )[0];

    const stakeAccountMetadata =
      (await this.program.account.stakeAccountMetadata.fetch(
        metadataAddress
      )) as any as StakeAccountMetadata; // TS complains about types. Not exactly sure why they're incompatible.

    const custodyAddress = (
      await PublicKey.findProgramAddress(
        [
          utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
          address.toBuffer(),
        ],
        this.program.programId
      )
    )[0];

    const authorityAddress = (
      await PublicKey.findProgramAddress(
        [
          utils.bytes.utf8.encode(wasm.Constants.AUTHORITY_SEED()),
          address.toBuffer(),
        ],
        this.program.programId
      )
    )[0];

    const mint = new Token(
      this.program.provider.connection,
      this.config.whTokenMint,
      TOKEN_PROGRAM_ID,
      new Keypair()
    );

    const tokenBalance = (await mint.getAccountInfo(custodyAddress)).amount;
    const totalSupply = (await mint.getMintInfo()).supply;

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
    owner: PublicKey,
  ): Promise<PublicKey> {
    const nonce = crypto.randomBytes(16).toString("hex");
    const stakeAccountAddress = await PublicKey.createWithSeed(
      this.userPublicKey(),
      nonce,
      this.program.programId
    );

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

  public async isLlcMember(stakeAccount: StakeAccount) {
    return (
      JSON.stringify(stakeAccount.stakeAccountMetadata.signedAgreementHash) ==
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
    const from_account = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      this.config.whTokenMint,
      this.provider.wallet.publicKey,
      true
    );

    const toAccount = (
      await PublicKey.findProgramAddress(
        [
          utils.bytes.utf8.encode(wasm.Constants.CUSTODY_SEED()),
          stakeAccountCheckpointsAddress.toBuffer(),
        ],
        this.program.programId
      )
    )[0];

    const ix = Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      from_account,
      toAccount,
      this.provider.wallet.publicKey,
      [],
      new u64(amount.toString())
    );

    return ix;
  }

  public async hasGovernanceRecord(user: PublicKey): Promise<boolean> {
    const voterAccountInfo =
      await this.program.provider.connection.getAccountInfo(
        await this.getTokenOwnerRecordAddress(user)
      );

    return Boolean(voterAccountInfo);
  }

  public async getTokenOwnerRecordAddress(user: PublicKey) {
    return getTokenOwnerRecordAddress(
      this.governanceAddress,
      this.config.whGovernanceRealm,
      this.config.whTokenMint,
      user
    );
  }

  public async delegate(
    stakeAccount: StakeAccount | undefined,
    delegateeStakeAccount: StakeAccount | undefined,
    amount: WHTokenBalance
  ) {
    let stakeAccountAddress: PublicKey;
    let delegateeStakeAccountAddress: PublicKey;
    const owner = this.provider.wallet.publicKey;

    const instructions: TransactionInstruction[] = [];
    const signers: Signer[] = [];

    if (!stakeAccount) {
      stakeAccountAddress = await this.withCreateAccount(instructions, owner);
    } else {
      stakeAccountAddress = stakeAccount.address;
    }

    if (!delegateeStakeAccount) {
      delegateeStakeAccountAddress = await this.withCreateAccount(instructions, owner);
    } else {
      delegateeStakeAccountAddress = delegateeStakeAccount.address;
    }

    if (!(await this.hasGovernanceRecord(owner))) {
      await withCreateTokenOwnerRecord(
        instructions,
        this.governanceAddress,
        PROGRAM_VERSION_V2,
        this.config.whGovernanceRealm,
        owner,
        this.config.whTokenMint,
        owner
      );
    }

    if (!stakeAccount || !(await this.isLlcMember(stakeAccount))) {
      await this.withJoinDaoLlc(instructions, stakeAccountAddress);
    }

    if (!delegateeStakeAccount || !(await this.isLlcMember(delegateeStakeAccount))) {
      await this.withJoinDaoLlc(instructions, delegateeStakeAccountAddress);
    }

    instructions.push(
      await this.buildTransferInstruction(stakeAccountAddress, amount.toBN())
    );

    instructions.push(
      await this.program.methods
        .delegate(delegateeStakeAccountAddress)
        .accounts({
          stakeAccountCheckpoints: stakeAccountAddress,
          currentDelegateStakeAccountCheckpoints: stakeAccountAddress,
          delegateeStakeAccountCheckpoints: delegateeStakeAccountAddress,
          mint: this.config.whTokenMint,
        })
        .instruction()
    );

    await this.sendAndConfirmAsVersionedTransaction(instructions);
  }

  /** Gets the current votes balance of the delegate's stake account. */
  public async getVotes(
    delegateStakeAccount: StakeAccount
  ): Promise<BN> {
     return delegateStakeAccount.getVotes();
  }

  /** Gets the voting power of the delegate's stake account at a specified past timestamp. */
  public async getPastVotes(
    delegateStakeAccount: StakeAccount,
    timestamp: BN
  ): Promise<BN> {
     return delegateStakeAccount.getPastVotes(timestamp);
  }

  /** Gets the current delegate's stake account associated with the specified stake account. */
  public async delegates(
    stakeAccount: StakeAccount,
  ): Promise<PublicKey> {
     return stakeAccount.delegates();
  }
}

export interface BalanceSummary {
  balance: WHTokenBalance;
}

export class StakeAccount {
  address: PublicKey;
  stakeAccountMetadata: StakeAccountMetadata;
  tokenBalance: u64;
  authorityAddress: PublicKey;
  totalSupply: BN;
  config: GlobalConfig;

  constructor(
    address: PublicKey,
    stakeAccountCheckpointsWasm: any,
    stakeAccountMetadata: StakeAccountMetadata,
    tokenBalance: u64,
    authorityAddress: PublicKey,
    totalSupply: BN,
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
  public async getVotes(): Promise<BN> {
    const voterVotes = this.stakeAccountCheckpointsWasm.getVoterVotes();

    return new BN(voterVotes.toString());
  }

  /** Gets the voting power at a specified past timestamp. */
  public async getPastVotes(timestamp: BN): Promise<BN> {
    const voterVotes = this.stakeAccountCheckpointsWasm.getVoterPastVotes(timestamp);

    return new BN(voterVotes.toString());
  }

  public async delegates(): Promise<PublicKey> {
     return this.stakeAccountMetadata.delegate();
  }

  public getBalanceSummary(unixTime: BN): BalanceSummary {
    let balanceBN = new BN(this.tokenBalance.toString());

    return {
      balance: new WHTokenBalance(balanceBN),
    };
  }
}
