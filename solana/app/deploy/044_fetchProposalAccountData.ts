// Usage: npx ts-node app/deploy/044_fetchProposalAccountData.ts

import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet_consts";
import { ethers } from "ethers";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
      {},
    );

    const proposalId = await input({ message: "Enter the proposal id:" });
    const proposalIdHex = BigInt(proposalId).toString(16).padStart(64, "0");
    //     console.log("proposalIdHex:", proposalIdHex);
    const proposalIdArray = Buffer.from(proposalIdHex, "hex");

    const stakeConnection = await StakeConnection.createStakeConnection(
      connection,
      provider.wallet as Wallet,
      STAKING_ADDRESS,
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
