// Usage: npx ts-node app/deploy/018_fetchSpokeMetadataCollector.ts

import { Wallet, AnchorProvider, utils } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import * as wasm from "@wormhole/staking-wasm";
import {
  DEPLOYER_AUTHORITY_KEYPAIR,
  RPC_NODE
} from "./devnet_consts";
import { STAKING_ADDRESS, HUB_CHAIN_ID, hubProposalMetadataUint8Array } from "../constants";
import { StakeConnection } from "../StakeConnection";
import fs from "fs";

async function main() {
  const connection = new Connection(RPC_NODE);
  const provider = new AnchorProvider(
    connection,
    new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
    {},
  );
  const stakeConnection = await StakeConnection.createStakeConnection(
    connection,
    provider.wallet as Wallet,
    STAKING_ADDRESS,
  );

  console.log("HUB_CHAIN_ID:", HUB_CHAIN_ID);
  console.log("hubProposalMetadataUint8Array:", hubProposalMetadataUint8Array);

  const [spokeMetadataCollector, _] = PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode(wasm.Constants.SPOKE_METADATA_COLLECTOR_SEED())],
    stakeConnection.program.programId,
  );
  console.log("spokeMetadataCollector:", spokeMetadataCollector);

  let spokeMetadataCollectorAccountData =
    await stakeConnection.program.account.spokeMetadataCollector.fetch(spokeMetadataCollector);
  console.log("spokeMetadataCollectorAccountData:", spokeMetadataCollectorAccountData);
}

main();
