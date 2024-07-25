import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet, } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS } from "../constants";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import BN from "bn.js";
import assert from "assert";

async function main() {
  try {
    const connection = new Connection(RPC_NODE);

    const provider = new AnchorProvider(
      connection,
      new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
      {}
    );

    const stakeConnection = await StakeConnection.createStakeConnection(
      connection,
      provider.wallet as Wallet,
      STAKING_ADDRESS
    );

    const proposalId = new BN(1);
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24*60*60); // 24 hour

    await stakeConnection.addProposal(proposalId, voteStart, safeWindow);

    const { proposalAccountData } = await stakeConnection.fetchProposalAccountData(proposalId);

    assert.equal(proposalAccountData.id.toString(), proposalId.toString());
    assert.equal(proposalAccountData.voteStart.toString(), voteStart.toString());
    assert.equal(proposalAccountData.safeWindow.toString(), safeWindow.toString());
    assert.equal(proposalAccountData.againstVotes.toString(), '0');
    assert.equal(proposalAccountData.forVotes.toString(), '0');
    assert.equal(proposalAccountData.abstainVotes.toString(), '0');
  } catch (err) {
    console.error("Error:", err);
  }
}

main();

