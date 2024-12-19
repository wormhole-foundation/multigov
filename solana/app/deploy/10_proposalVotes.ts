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

    const proposalIdHex =
      "01560dfa1adfd9ba4546b29b5d115c4a09c607f33588599455fa0698a512e59c";
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
