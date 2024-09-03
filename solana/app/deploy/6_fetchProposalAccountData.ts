import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import BN from "bn.js";

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

    const proposalId = new BN(4);
    const { proposalAccountData } =
      await stakeConnection.fetchProposalAccountData(proposalId);
    console.log("proposalAccountData:", proposalAccountData);

    console.log("againstVotes:", proposalAccountData.againstVotes.toNumber());
    console.log("forVotes:", proposalAccountData.forVotes.toNumber());
    console.log("abstainVotes:", proposalAccountData.abstainVotes.toNumber());
    console.log("voteStart:", proposalAccountData.voteStart.toNumber());
    console.log("safeWindow:", proposalAccountData.safeWindow.toNumber());
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
