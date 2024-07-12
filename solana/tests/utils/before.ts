import { exec } from "child_process";
import { mkdtemp } from "fs/promises";
import {
  PublicKey,
  Connection,
  Keypair,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import fs from "fs";
import { Program, Wallet, utils, AnchorProvider } from "@coral-xyz/anchor";
import * as wasm from "@wormhole/staking-wasm";
import {
  TOKEN_PROGRAM_ID,
  Token,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import {
  GovernanceConfig,
  GoverningTokenType,
  MintMaxVoteWeightSource,
  PROGRAM_VERSION_V2,
  VoteThreshold,
  VoteThresholdType,
  VoteTipping,
  withCreateGovernance,
  withCreateNativeTreasury,
  withCreateRealm,
} from "@solana/spl-governance";
import shell from "shelljs";
import BN from "bn.js";
import toml from "toml";
import path from "path";
import os from "os";
import { StakeConnection, WHTokenBalance, WH_TOKEN_DECIMALS } from "../../app";
import { GlobalConfig } from "../../app/StakeConnection";
import { createMint, initAddressLookupTable } from "./utils";
import { loadKeypair } from "./keys";

export const ANCHOR_CONFIG_PATH = "./Anchor.toml";
export interface AnchorConfig {
  path: {
    idl_path: string;
    binary_path: string;
    governance_path: string;
    chat_path: string;
    wallet_tester_path: string;
    profile_path: string;
  };
  provider: {
    cluster: string;
    wallet: string;
  };
  programs: {
    localnet: {
      staking: string;
      governance: string;
      chat: string;
      wallet_tester: string;
      profile: string;
    };
  };
  validator: {
    port: number;
    ledger_dir: string;
  };
}

export function readAnchorConfig(pathToAnchorToml: string): AnchorConfig {
  const config: AnchorConfig = toml.parse(
    fs.readFileSync(pathToAnchorToml).toString()
  );

  return config;
}

export function getDummyAgreementHash(): number[] {
  return Array.from({ length: 32 }, (_, i) => i);
}

export function getDummyAgreementHash2(): number[] {
  return Array.from({ length: 32 }, (_, i) => 2);
}

/**
 * Deterministically determines the port for deploying the validator basing of the index of the testfile in the sorted
 * list of all testsfiles.
 * Two ports are needed (one for RPC and another one for websocket)
 */
export function getPortNumber(filename: string) {
  const index = fs.readdirSync("./tests/").sort().indexOf(filename);
  const portNumber = 8899 - 2 * index;
  return portNumber;
}
/**
 * If we abort immediately, the websockets are still subscribed, and they give a ton of errors.
 * Waiting a few seconds is enough to let the sockets close.
 */
export class CustomAbortController {
  abortController: AbortController;
  constructor(abortController: AbortController) {
    this.abortController = abortController;
  }
  abort() {
    setTimeout(() => this.abortController.abort(), 5000);
  }
}

/**
 * Starts a validator at port portNumber with the command line arguments specified after a few basic ones
 *
 * returns a `{ controller, connection }` struct. Users of this method have to terminate the
 * validator by calling :
 * ```controller.abort()```
 */
export async function startValidatorRaw(portNumber: number, otherArgs: string) {
  const connection: Connection = getConnection(portNumber);
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "ledger-"));

  const internalController: AbortController = new AbortController();
  const { signal } = internalController;

  exec(
    `solana-test-validator --ledger ${ledgerDir} --rpc-port ${portNumber} --faucet-port ${
      portNumber + 101
    } ${otherArgs}`,
    { signal },
    (error, stdout, stderr) => {
      if (error.name.includes("AbortError")) {
        // Test complete, this is expected.
        return;
      }
      if (error) {
        console.error(`exec error: ${error}`);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);
    }
  );
  const controller = new CustomAbortController(internalController);

  let numRetries = 0;
  while (true) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await connection.getSlot();
      break;
    } catch (e) {
      // Bound the number of retries so the tests don't hang if there's some problem blocking
      // the connection to the validator.
      if (numRetries == 30) {
        console.log(
          `Failed to start validator or connect to running validator. Caught exception: ${e}`
        );
        throw e;
      }
      numRetries += 1;
    }
  }
  return { controller, connection };
}

/**
 * Starts a validator at port portNumber with the staking program deployed the address defined in lib.rs.
 * Also takes config as an argument, config is obtained by parsing Anchor.toml
 *
 * ```const config = readAnchorConfig(ANCHOR_CONFIG_PATH)```
 *
 * returns a `{controller, program, provider}` struct. Users of this method have to terminate the
 * validator by calling :
 * ```controller.abort()```
 */
export async function startValidator(portNumber: number, config: AnchorConfig) {
  const programAddress = new PublicKey(config.programs.localnet.staking);
  const idlPath = config.path.idl_path;
  const binaryPath = config.path.binary_path;

  const user = loadKeypair(config.provider.wallet);

  const otherArgs = `--mint ${
    user.publicKey
  } --reset --bpf-program ${programAddress.toBase58()} ${binaryPath} --bpf-program ${
    config.programs.localnet.governance
  } ${config.path.governance_path} --bpf-program ${
    config.programs.localnet.chat
  } ${config.path.chat_path}

  --clone ENmcpFCpxN1CqyUjuog9yyUVfdXBKF3LVCwLr7grJZpk -ud`;

  const { controller, connection } = await startValidatorRaw(
    portNumber,
    otherArgs
  );

  const provider = new AnchorProvider(connection, new Wallet(user), {});
  const program = new Program(
    JSON.parse(fs.readFileSync(idlPath).toString()),
    programAddress,
    provider
  );

  shell.exec(
    `anchor idl init -f ${idlPath} ${programAddress.toBase58()}  --provider.cluster ${
      connection.rpcEndpoint
    }`
  );

  return { controller, program, provider };
}

export function getConnection(portNumber: number): Connection {
  return new Connection(
    `http://127.0.0.1:${portNumber}`,
    AnchorProvider.defaultOptions().commitment
  );
}

/**
 * Request and deliver an airdrop of Wormhole tokens to the associated token account of ```destination```
 */
export async function requestWHTokenAirdrop(
  destination: PublicKey,
  whMintAccount: PublicKey,
  whMintAuthority: Keypair,
  amount: WHTokenBalance,
  connection: Connection
) {
  // Testnet airdrop to ensure that the WH authority can pay for gas
  await connection.requestAirdrop(whMintAuthority.publicKey, 1_000_000_000);

  const transaction = new Transaction();

  const destinationAta = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    whMintAccount,
    destination,
    true
  );

  if ((await connection.getAccountInfo(destinationAta)) == null) {
    const createAtaIx = Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      whMintAccount,
      destinationAta,
      destination,
      whMintAuthority.publicKey
    );
    transaction.add(createAtaIx);
  }

  const mintIx = Token.createMintToInstruction(
    TOKEN_PROGRAM_ID,
    whMintAccount,
    destinationAta,
    whMintAuthority.publicKey,
    [],
    new u64(amount.toBN().toString())
  );
  transaction.add(mintIx);

  await connection.sendTransaction(transaction, [whMintAuthority], {
    skipPreflight: true,
  });
}

interface GovernanceIds {
  realm: PublicKey;
  governance: PublicKey;
}

/*
  Creates a governance realm using the SPL-governance deployment in config.
  Creates an account governance with a 20% vote threshold that can sign using the PDA this function returns.
*/
export async function createDefaultRealm(
  provider: AnchorProvider,
  config: AnchorConfig,
  maxVotingTime: number, // in seconds
  whMint: PublicKey
): Promise<GovernanceIds> {
  const realmAuthority = Keypair.generate();
  const tx = new Transaction();
  const govProgramId = new PublicKey(config.programs.localnet.governance);

  const realm = await withCreateRealm(
    tx.instructions,
    govProgramId,
    PROGRAM_VERSION_V2,
    "Wormhole Governance",
    realmAuthority.publicKey,
    whMint,
    provider.wallet.publicKey,
    undefined, // no council mint
    MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION,
    new BN(200), // 200 required so we can create governances during tests
    {
      voterWeightAddin: new PublicKey(config.programs.localnet.staking),
      maxVoterWeightAddin: new PublicKey(config.programs.localnet.staking),
      tokenType: GoverningTokenType.Liquid,
    },
    undefined
  );

  const governance = await withCreateDefaultGovernance(
    tx,
    maxVotingTime,
    govProgramId,
    realm,
    new PublicKey(0),
    provider.wallet.publicKey,
    realmAuthority.publicKey,
    null
  );

  const mintGov = await withCreateNativeTreasury(
    tx.instructions,
    govProgramId,
    PROGRAM_VERSION_V2,
    governance,
    provider.wallet.publicKey
  );

  await provider.sendAndConfirm(tx, [realmAuthority], { skipPreflight: true });

  // Give governance 100 SOL to play with
  await provider.connection.requestAirdrop(mintGov, LAMPORTS_PER_SOL * 100);

  return { realm, governance };
}

export async function initConfig(
  program: Program,
  whMintAccount: PublicKey,
  globalConfig: GlobalConfig
) {
  const [configAccount, bump] = await PublicKey.findProgramAddress(
    [utils.bytes.utf8.encode(wasm.Constants.CONFIG_SEED())],
    program.programId
  );

  await program.methods.initConfig(globalConfig).rpc({
    skipPreflight: true,
  });
}

export function makeDefaultConfig(
  whMint: PublicKey,
  governanceProgram: PublicKey = PublicKey.unique(),
  pdaAuthority: PublicKey = PublicKey.unique()
): GlobalConfig {
  return {
    governanceAuthority: null,
    whGovernanceRealm: null,
    whTokenMint: whMint,
    freeze: true,
    mockClockTime: new BN(10),
    bump: 0,
    governanceProgram,
    pdaAuthority,
    agreementHash: getDummyAgreementHash(),
  };
}

export async function withCreateDefaultGovernance(
  tx: Transaction,
  maxVotingTime: number,
  govProgramId: PublicKey,
  realm: PublicKey,
  tokenOwnerRecord: PublicKey,
  payer: PublicKey,
  authority: PublicKey,
  voterWeightRecord: PublicKey
) {
  const governanceConfig = new GovernanceConfig({
    communityVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.YesVotePercentage,
      value: 20,
    }),
    minCommunityTokensToCreateProposal: WHTokenBalance.fromNumber(200).toBN(),
    minInstructionHoldUpTime: 1,
    baseVotingTime: maxVotingTime,
    minCouncilTokensToCreateProposal: new BN(1),
    councilVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.YesVotePercentage,
      value: 0,
    }),
    councilVetoVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.YesVotePercentage,
      value: 0,
    }),
    communityVetoVoteThreshold: new VoteThreshold({
      type: VoteThresholdType.YesVotePercentage,
      value: 0,
    }),
    councilVoteTipping: VoteTipping.Strict,
    votingCoolOffTime: 0,
    depositExemptProposalCount: 255,
  });
  const governance = await withCreateGovernance(
    tx.instructions,
    govProgramId,
    PROGRAM_VERSION_V2,
    realm,
    tokenOwnerRecord,
    governanceConfig,
    tokenOwnerRecord,
    payer,
    authority,
    voterWeightRecord
  );

  return governance;
}

/**
 * Standard setup for test, this function :
 * - Launches at validator at `portNumber`
 * - Creates a Wormhole token in the localnet environment
 * - Airdrops Wormhole token to the currently connected wallet
 * - Initializes the global config of the wormhole staking program to some default values
 * - Creates a connection to the localnet wormhole staking program
 * */
export async function standardSetup(
  portNumber: number,
  config: AnchorConfig,
  whMintAccount: Keypair,
  whMintAuthority: Keypair,
  globalConfig: GlobalConfig,
  amount?: WHTokenBalance
) {
  const { controller, program, provider } = await startValidator(
    portNumber,
    config
  );

  await createMint(
    provider,
    whMintAccount,
    whMintAuthority.publicKey,
    null,
    WH_TOKEN_DECIMALS,
    TOKEN_PROGRAM_ID
  );

  const user = provider.wallet.publicKey;

  await requestWHTokenAirdrop(
    user,
    whMintAccount.publicKey,
    whMintAuthority,
    amount ? amount : WHTokenBalance.fromString("200"),
    program.provider.connection
  );

  if (globalConfig.whGovernanceRealm == null) {
    const { realm, governance } = await createDefaultRealm(
      provider,
      config,
      3600 * 24 * 7,
      whMintAccount.publicKey
    );
    globalConfig.governanceAuthority = governance;
    globalConfig.whGovernanceRealm = realm;
  }

  if (globalConfig.pdaAuthority == null) {
    globalConfig.pdaAuthority = user;
  }

  const temporaryConfig = { ...globalConfig };
  // User becomes a temporary dictator during setup
  temporaryConfig.governanceAuthority = user;

  await initConfig(program, whMintAccount.publicKey, temporaryConfig);

  const lookupTableAddress = await initAddressLookupTable(
    provider,
    whMintAccount.publicKey
  );
  console.log("Lookup table address: ", lookupTableAddress.toBase58());

  // Give the power back to the people
  await program.methods
    .updateGovernanceAuthority(globalConfig.governanceAuthority)
    .accounts({ governanceSigner: user })
    .rpc();

  const connection = new Connection(
    `http://127.0.0.1:${portNumber}`,
    AnchorProvider.defaultOptions().commitment
  );

  const stakeConnection = await StakeConnection.createStakeConnection(
    connection,
    provider.wallet as Wallet,
    new PublicKey(config.programs.localnet.staking)
  );

  return { controller, stakeConnection };
}
