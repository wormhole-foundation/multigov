// Usage: npx ts-node app/deploy/devnet/tests/16_castVote.ts

import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../../../StakeConnection";
import { USER2_AUTHORITY_KEYPAIR, RPC_NODE } from "../constants";
import BN from "bn.js";
import input from "@inquirer/input";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const user2Provider = new AnchorProvider(
      connection,
      new Wallet(USER2_AUTHORITY_KEYPAIR),
      {},
    );

    const proposalId = await input({ message: "Enter the proposal id:" });
    const proposalIdHex = BigInt(proposalId).toString(16).padStart(64, "0");
    //     console.log("proposalIdHex:", proposalIdHex);
    const proposalIdArray = Buffer.from(proposalIdHex, "hex");

    const user2StakeConnection = await StakeConnection.createStakeConnection(
      connection,
      user2Provider.wallet as Wallet,
    );

    await user2StakeConnection.castVote(
      proposalIdArray,
      new BN(2),
      new BN(30),
      new BN(3),
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
