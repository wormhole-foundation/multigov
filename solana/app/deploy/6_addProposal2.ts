import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import { StakeConnection } from "../StakeConnection";
import { STAKING_ADDRESS, CORE_BRIDGE_ADDRESS } from "../constants";
import { DEPLOYER_AUTHORITY_KEYPAIR, RPC_NODE } from "./devnet";
import { getWormholeBridgeData } from "../helpers/wormholeBridgeConfig";

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

    const sepoliaEthProposalResponse = {
      bytes:
        "0100003b7c62c2edf3d3eb4c4616c37cbe9062747c6f6a0ebc1bc9fea030ed7fca3f586980a5564e1efd4d266531ed37bfe10e853b8d1594ddeb060959f8a2d004bfb20000000063010000000001271203000000560000000830783665303830640000000966696e616c697a6564011a3e5624769c3dc9106347a239523e4a08d85c3800000024eb9b9838a6d7c4e924a0b24dd00c25bdf4a4d6b8dac6f32496098f41ed5c9d9a31722d75012712030000007500000000006e080df6ef6ca1e869e64440edae78e44c0ce41cad03e11280d1c4728660786464927a000628753cc398000100000040a6d7c4e924a0b24dd00c25bdf4a4d6b8dac6f32496098f41ed5c9d9a31722d75000000000000000000000000000000000000000000000000000000006750929a",
      signatures: [
        "9d659171c48b80bc842fc63cc23d8c14d920cf56ae4499888d89ec9306b779ee4fffab79d0ed838b1b56e1676b973efc352eb75d4447fe2fbef685244832d1c10000",
      ],
    };

    const proposalIdArray = Buffer.from(
      "a6d7c4e924a0b24dd00c25bdf4a4d6b8dac6f32496098f41ed5c9d9a31722d75",
      "hex",
    );

    const guardianSignaturesPda = await stakeConnection.postSignatures(
      sepoliaEthProposalResponse.signatures,
    );

    await stakeConnection.addProposal(
      proposalIdArray,
      Buffer.from(sepoliaEthProposalResponse.bytes, "hex"),
      guardianSignaturesPda,
      guardianSetIndex,
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
