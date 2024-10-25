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
        "010000043a7905dc1d4b285e608665a2b0e28c9d1400844afd80d84f4eec05cd86cf33115289b25f2ea6d9f7ac05ee3c48f17e310bd37c31a591cb323e0515a98cb3c70000000063010000000001271203000000560000000830783639323831350000000966696e616c697a6564012574802db8590ee5c9efc5ebebfef1e174b712fc00000024eb9b9838462c69856d29579a9fd5d80ced46f98862f1c83b47c04b928676f7e6919ad1f20127120300000075000000000069281548a531278029348c7b21e7e2cdf20c4eba0cb34badd1d4dd90371788035bc18f000624a8d8e118000100000040462c69856d29579a9fd5d80ced46f98862f1c83b47c04b928676f7e6919ad1f200000000000000000000000000000000000000000000000000000000670cd112",
      signatures: [
        "3e2442b29e9054acafc3e9a39414ddf2d5e09cbbfd9ca86673249788d7d3571c66f0cb85737845db161c9e335b9e46b5d21d4af582d2ad0658eb5420db58bd470100"
      ],
    };
    
    const proposalIdArray = Buffer.from("462c69856d29579a9fd5d80ced46f98862f1c83b47c04b928676f7e6919ad1f2", "hex");

    const signaturesKeypair = Keypair.generate();
    await stakeConnection.postSignatures(
      sepoliaEthProposalResponse.signatures,
      signaturesKeypair,
    );

    await stakeConnection.addProposal(
      proposalIdArray,
      Buffer.from(sepoliaEthProposalResponse.bytes, "hex"),
      signaturesKeypair.publicKey,
      guardianSetIndex,
    );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
