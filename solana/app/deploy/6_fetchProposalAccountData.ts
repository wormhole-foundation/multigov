import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import BN from "bn.js";
import { ethers } from "ethers";

async function main() {
  try {
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

    const proposalIdHex = "462c69856d29579a9fd5d80ced46f98862f1c83b47c04b928676f7e6919ad1f2"
    console.log("proposalIdHex:", proposalIdHex);

    const voteStartHex = "00000000000000000000000000000000000000000000000000000000670cd112"
    const voteStartInt = (new BN(voteStartHex, 16)).toString(10);
    console.log("voteStartInt:", voteStartInt);

    const proposalIdArray = Buffer.from(proposalIdHex, "hex");
    const { proposalAccountData } =
      await stakeConnection.fetchProposalAccountData(proposalIdArray);

    const proposalId = new ethers.AbiCoder().decode(
      ["uint256"],
      Buffer.from(proposalAccountData.id)
    )[0].toString();

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
