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
        "010000c567b0dbc502f6493c9ed49f2dd2e5b518c318a532ef2850675aa158087bc6d20edb56523bb6fd465a4ba7eea09d23f168a8f2295d6f8d5b6b02ea8f4160772e0100000063010000000001271203000000560000000830783639356333390000000966696e616c697a6564012574802db8590ee5c9efc5ebebfef1e174b712fc00000024eb9b983889813b2c3ac79b429a4143dc4df617bee40d585d44e5763c64994efc854b05db01271203000000750000000000695c39260d011444b6949f5787b17bae7179bbdc42677778596bf6bf6cd864d90277ef000624d5e8861800010000004089813b2c3ac79b429a4143dc4df617bee40d585d44e5763c64994efc854b05db000000000000000000000000000000000000000000000000000000006713cb56",
      signatures: [
        "b15bb75a39700c41fe493568ecb09a72bc9d811fbdc0f5fc1618931d9d1a926121c2951d6bd2d207e0dd0fa4f947d35cf7dec881051b6d1ef8fcf4f2c211cbb30000",
      ],
    };

    const proposalIdArray = Buffer.from(
      "89813b2c3ac79b429a4143dc4df617bee40d585d44e5763c64994efc854b05db",
      "hex",
    );

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
