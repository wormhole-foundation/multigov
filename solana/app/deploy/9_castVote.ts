import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { USER2_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import BN from "bn.js";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);
    const user2Provider = new AnchorProvider(
      connection,
      new Wallet(USER2_AUTHORITY_KEYPAIR),
      {},
    );

    const user2StakeConnection = await StakeConnection.createStakeConnection(
      connection,
      user2Provider.wallet as Wallet,
      STAKING_ADDRESS,
    );

    const proposalIdHex =
      "a6d7c4e924a0b24dd00c25bdf4a4d6b8dac6f32496098f41ed5c9d9a31722d75";
    const proposalIdArray = Buffer.from(proposalIdHex, "hex");

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
