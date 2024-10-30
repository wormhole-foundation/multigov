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
      "89813b2c3ac79b429a4143dc4df617bee40d585d44e5763c64994efc854b05db";
    const proposalIdArray = Buffer.from(proposalIdHex, "hex");

    await user2StakeConnection.castVote(
      proposalIdArray,
      new BN(10),
      new BN(20),
      new BN(12),
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
