// Usage: npx ts-node app/deploy/devnet/tests/24_fetchProposalAccountData.ts

import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../../../StakeConnection";
import { USER2_AUTHORITY_KEYPAIR, RPC_NODE } from "../constants";
import { ethers } from "ethers";
import input from "@inquirer/input";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(USER2_AUTHORITY_KEYPAIR),
      {},
    );

    const inputProposalId = await input({ message: "Enter the proposal id:" });
    const proposalIdHex = BigInt(inputProposalId)
      .toString(16)
      .padStart(64, "0");
    //     console.log("proposalIdHex:", proposalIdHex);
    const proposalIdArray = Buffer.from(proposalIdHex, "hex");

    const stakeConnection = await StakeConnection.createStakeConnection(
      connection,
      provider.wallet as Wallet,
    );

    const { proposalAccountData } =
      await stakeConnection.fetchProposalAccountData(proposalIdArray);

    const proposalId = new ethers.AbiCoder()
      .decode(["uint256"], Buffer.from(proposalAccountData.id))[0]
      .toString();

    console.log("Parse proposalAccountData:");
    console.log("proposalId:", proposalId);
    console.log("againstVotes:", proposalAccountData.againstVotes.toNumber());
    console.log("forVotes:", proposalAccountData.forVotes.toNumber());
    console.log("abstainVotes:", proposalAccountData.abstainVotes.toNumber());
    console.log("voteStart:", proposalAccountData.voteStart.toNumber());
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
