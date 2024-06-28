import {
  GoverningTokenType,
  MintMaxVoteWeightSource,
  PROGRAM_VERSION,
  withCreateRealm,
} from "@solana/spl-governance";
import { Transaction, Connection } from "@solana/web3.js";
import { BN } from "bn.js";

import { AUTHORITY_KEYPAIR, WORMHOLE_TOKEN, RPC_NODE } from "./mainnet_beta";
import { STAKING_ADDRESS, GOVERNANCE_ADDRESS } from "../constants";

async function main() {
  const tx = new Transaction();

  await withCreateRealm(
    tx.instructions,
    GOVERNANCE_ADDRESS(), // Address of the governance program
    PROGRAM_VERSION, // Version of the on-chain governance program
    "Wormhole Governance", // `name` of the realm
    AUTHORITY_KEYPAIR.publicKey, // Address of the realm authority
    WORMHOLE_TOKEN, // Address of the Wormhole token
    AUTHORITY_KEYPAIR.publicKey, // Address of the payer
    undefined, // No council mint
    MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION, // Irrelevant because we use the max voter weight plugin
    new BN(
      "18446744073709551615" // u64::MAX
    ),
    {
      voterWeightAddin: STAKING_ADDRESS, // Voter weight plugin
      maxVoterWeightAddin: STAKING_ADDRESS, // Max voter weight plugin
      tokenType: GoverningTokenType.Dormant, // Users should never deposit tokens but instead use the staking program
    },
    undefined // No council mint
  );

  const client = new Connection(RPC_NODE);

  await client.sendTransaction(tx, [AUTHORITY_KEYPAIR]);
}

main();
