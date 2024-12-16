// Usage: npx ts-node app/e2e/03_castVote.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { USER2_AUTHORITY_KEYPAIR, RPC_NODE } from "../deploy/devnet";
import BN from "bn.js";
import { WHTokenBalance } from "../whTokenBalance";
import input from "@inquirer/input";

async function castVote() {
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
      STAKING_ADDRESS,
    );

    await user2StakeConnection.castVote(
      proposalIdArray,
      WHTokenBalance.fromString("2000").toBN(),
      WHTokenBalance.fromString("3000000").toBN(),
      WHTokenBalance.fromString("50000").toBN(),
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

castVote();
