import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { WHTokenBalance } from "../whTokenBalance";
import { STAKING_ADDRESS } from "../constants";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    await stakeConnection.delegate(undefined, WHTokenBalance.fromString("10"));
    await sleep(10000);

    const user = provider.wallet.publicKey;
    console.log("user:", user);
    await stakeConnection.delegate(user, WHTokenBalance.fromString("10"));
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
