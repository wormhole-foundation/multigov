import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS, CORE_BRIDGE_ADDRESS } from "../constants";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import BN from "bn.js";
import assert from "assert";
import crypto from 'crypto';
import { getWormholeBridgeData } from "../helpers/wormholeBridgeConfig";
import { createAddProposalTestBytes } from "../../tests/utils/api_utils";

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

    const info = await getWormholeBridgeData(connection, CORE_BRIDGE_ADDRESS);
    let guardianSetIndex = info.guardianSetIndex;
    const mockGuardianSetIndex = 5;

    const proposalIdInput = crypto.createHash('sha256').update('proposalId4').digest();
    console.log("proposalIdInput:", proposalIdInput.toString('hex'));
    const voteStart = Math.floor(Date.now() / 1000);

    const ethProposalResponseBytes = createAddProposalTestBytes(proposalIdInput, voteStart);
    const signaturesKeypair = Keypair.generate();
    const mock = new QueryProxyMock({});
    const mockSignatures = mock.sign(
      ethProposalResponseBytes
    );
    await stakeConnection.postSignatures(mockSignatures, signaturesKeypair);

    await stakeConnection.addProposal(
      proposalIdInput,
      ethProposalResponseBytes,
      signaturesKeypair.publicKey,
      mockGuardianSetIndex
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
