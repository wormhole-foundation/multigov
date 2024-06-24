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
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import * as wasm2 from "@wormhole/staking-wasm";
import {
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import BN from "bn.js";
import { Staking } from "../target/types/staking";
import IDL from "../target/idl/staking.json";
import { WHTokenBalance } from "./whTokenBalance";
import {
  EPOCH_DURATION,
  GOVERNANCE_ADDRESS,
  STAKING_ADDRESS,
} from "./constants";
let wasm = wasm2;
export { wasm };

export type GlobalConfig = IdlAccounts<Staking>["globalConfig"];
type StakeAccountMetadata = IdlAccounts<Staking>["stakeAccountMetadata"];

export class StakeConnection {
  program: Program<Staking>;
  provider: AnchorProvider;
  config: GlobalConfig;
  configAddress: PublicKey;
  governanceAddress: PublicKey;
  addressLookupTable: PublicKey | undefined;

  private constructor(
    program: Program<Staking>,
    provider: AnchorProvider,
    config: GlobalConfig,
    configAddress: PublicKey,
    addressLookupTable: PublicKey | undefined,
  ) {
    this.program = program;
    this.provider = provider;
    this.config = config;
    this.configAddress = configAddress;
    this.governanceAddress = GOVERNANCE_ADDRESS();
    this.addressLookupTable = addressLookupTable;
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

  /** Stake accounts are loaded by a StakeConnection object */
  public async loadStakeAccount(address: PublicKey): Promise<StakeAccount> {
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
    stakeAccountMetadata: StakeAccountMetadata,
    tokenBalance: u64,
    authorityAddress: PublicKey,
    totalSupply: BN,
    config: GlobalConfig
  ) {
    this.address = address;
    this.stakeAccountMetadata = stakeAccountMetadata;
    this.tokenBalance = tokenBalance;
    this.authorityAddress = authorityAddress;
    this.totalSupply = totalSupply;
    this.config = config;
  }
}
