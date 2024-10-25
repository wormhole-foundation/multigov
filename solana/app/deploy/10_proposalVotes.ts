import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { USER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const provider = new AnchorProvider(
      connection,
      new Wallet(USER_AUTHORITY_KEYPAIR),
      {},
    );

    const stakeConnection = await StakeConnection.createStakeConnection(
      connection,
      provider.wallet as Wallet,
      STAKING_ADDRESS,
    );

    const proposalIdHex = "462c69856d29579a9fd5d80ced46f98862f1c83b47c04b928676f7e6919ad1f2"
    const proposalIdArray = Buffer.from(proposalIdHex, "hex");

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await stakeConnection.proposalVotes(proposalIdArray);

    console.log("proposalId", proposalId.toString("hex"));
    console.log("againstVotes", againstVotes.toString());
    console.log("forVotes", forVotes.toString());
    console.log("abstainVotes", abstainVotes.toString());
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
