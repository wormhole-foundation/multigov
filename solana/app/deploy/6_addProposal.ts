import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import BN from "bn.js";
import assert from "assert";
import crypto from 'crypto';

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

    const proposalId = crypto.createHash('sha256').update('proposalId4').digest();
    console.log("proposalId:", proposalId.toString('hex'));

    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24 * 60 * 60); // 24 hour

    await stakeConnection.addProposal(proposalId, voteStart, safeWindow);
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
