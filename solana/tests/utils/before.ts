import { exec } from "child_process";
import { mkdtemp } from "fs/promises";
import {
  PublicKey,
  Connection,
} from "@solana/web3.js";
import fs from "fs";
import { Program, Wallet, utils, AnchorProvider } from "@coral-xyz/anchor";
import * as wasm from "@pythnetwork/staking-wasm";
import shell from "shelljs";
import BN from "bn.js";
import toml from "toml";
import path from "path";
import os from "os";
import { StakeConnection } from "../../app";
import { GlobalConfig } from "../../app/StakeConnection";
import {
  initAddressLookupTable,
} from "./utils";
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
  } ${config.path.chat_path}  --bpf-program ${
    config.programs.localnet.wallet_tester
  } ${config.path.wallet_tester_path} --bpf-program ${
    config.programs.localnet.profile
  } ${config.path.profile_path}

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

export async function initConfig(
  program: Program,
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
  governanceProgram: PublicKey = PublicKey.unique(),
  pdaAuthority: PublicKey = PublicKey.unique()
): GlobalConfig {
  return {
    governanceAuthority: null,
    epochDuration: new BN(3600),
    freeze: true,
    mockClockTime: new BN(10),
    bump: 0,
    governanceProgram,
    pdaAuthority,
    agreementHash: getDummyAgreementHash(),
  };
}

/**
 * Standard setup for test, this function :
 * - Launches at validator at `portNumber`
 * - Initializes the global config of the wormhole staking program to some default values
 * - Creates a connection to the localnet wormhole staking program
 * */
export async function standardSetup(
  portNumber: number,
  config: AnchorConfig,
  globalConfig: GlobalConfig
) {
  const { controller, program, provider } = await startValidator(
    portNumber,
    config
  );

  const user = provider.wallet.publicKey;

  if (globalConfig.pdaAuthority == null) {
    globalConfig.pdaAuthority = user;
  }

  const temporaryConfig = { ...globalConfig };
  // User becomes a temporary dictator during setup
  temporaryConfig.governanceAuthority = user;

  await initConfig(program, temporaryConfig);

  const lookupTableAddress = await initAddressLookupTable(
    provider,
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
