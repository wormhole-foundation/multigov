import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { PublicKey, Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { USER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import BN from "bn.js";

async function main() {
  try {
    const stakeAccount = new PublicKey(
      // stakeAccountSecret.publicKey generated in  3_create_stake_account.ts
      "EHbjaCjypw3HAZMWskLhX1KtmVUDmNFrijPcBtfqH8S3",
    );

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

    const proposalId = new BN(4);

    const { againstVotes, forVotes, abstainVotes } =
      await stakeConnection.proposalVotes(proposalId);

    console.log("againstVotes", againstVotes.toString());
    console.log("forVotes", forVotes.toString());
    console.log("abstainVotes", abstainVotes.toString());
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
