// Usage: npx ts-node app/deploy/mainnet/tests/15_addProposal.ts

import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { StakeConnection } from "../../../StakeConnection";
import {
  CORE_BRIDGE_PID,
  DEPLOYER_AUTHORITY_KEYPAIR,
  RPC_NODE,
} from "../constants";
import { getWormholeBridgeData } from "../../../helpers/wormholeBridgeConfig";
import input from "@inquirer/input";

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
    );

    const info = await getWormholeBridgeData(connection, CORE_BRIDGE_PID);
    let guardianSetIndex = info.guardianSetIndex;

    const mainnetEthProposalResponse = {
      bytes:
        "01000091c88387e43b5949ff6c07d4251571f9328baf9accb55ef61480117a540a9d4a6b845f8c0410b0244f8e9c0c8378642f1ad175ad77e2ca1c326941fff9246d60000000006401000000000100020300000057000000093078313531643936650000000966696e616c697a656401e1485b53e6e94ad4b82b19e48da1911d2e19bfae00000024eb9b9838fcdbb9499c27488ca8300323b4f6b3b08802093c3d822d931ef0149f797116df0100020300000075000000000151d96e08eaca24e456367d064e1fdaa2fed41e383bc581dfa6010d6c4443199ab117100006315aa3ab63c00100000040fcdbb9499c27488ca8300323b4f6b3b08802093c3d822d931ef0149f797116df0000000000000000000000000000000000000000000000000000000067e5527d",
      signatures: [
        "a9e756c766edaae672144d8799dbb927f6bc6c34f4769e9a1010cfea0818ce074ba9fd65713914e3f4dd66f45181032129c76b0af825213187be3c53ef62f0330100",
        "82c78d62baa11304c1fa0c345e819d68798f9e183b55a4fc506b64a72bb0681e41b243d87d53fd9766723c1dc02a951730f1b4b178ceb11412d0891afd63bf4c0002",
        "5819250b9ac5eb8a2896c99ea3a91af418643fab0b25e4547021e5ad673412fb6226e820ae6454bad9c0a15da406a32b0341d8b73fa426453df204f2f9f4ded20103",
        "218c79a4deaf8a111d4573b55e33e77c40bc3f995d79d9edfc271d6a1bf1a1111aee8332800d45e8ad629429bbde3f6026f31bb8baa72c23adbc8a55cbaf44700106",
        "40f0738532d9c3fd5921bbd2b058768f79ecbc4efd9dc3f14cbabb04e378cf1023792ea66ab44e92205f12c6552c25a2377460ca3fa1d90396de8e69bb99e5080007",
        "72f0a5715c5c069baeba3e9586abfe661812671f9a12c73af375b3de92c128834657ded1a9159c9ce9ea6bb712cc98f4b0d5d3d45173ecac68b70f2a31aa3efa0109",
        "eea28b273c3bc13f2e0ccabfea2e9760d92b45d87217281babce73976097a04106da9d153abd7d344b3a99b77065c095cfa85bc6ae95518d105ba73b5c06faf3000b",
        "2655cdba9ef7707c6f9204d0ca02f779c8686e559d94cd4145eab84f9cb2df702daaced2bb74b1dd242b59a6b670da8c127c855c1b6b502e215e4e08467580bf010c",
        "deed51fa86f355c5b6916873aa6b5d2b8bf798feec720da5e16b5ec05049b511278cb1f952cd9d01a3b3585ba7fe4a57c94c2f387137fa985424ae406d368467000d",
        "53df6deebeda09aa91dacd9e32aa10663a03fb081c51d0a19887fddb30f147290ed1a74e3185009d961b235828792efa7c1a44fb2b39342837a4e321187e6673010e",
        "7b88e420e5337bbb04cfd39b1c7f1c076837e32e859e8dc841fde3a71c9fffcc30400ec2896202ed37b7ca9ba12e2b03d6d35ad45f8501a77234bacf4f6698280010",
        "186079ac19355cc723ae9276eef7c6940b45ed6993757f06a21c0c640ed45a8139ff2b7480e1a290bc8ffa1ced663af74b9fc56ac60dc7ff316bb6ec2bf6faf10111",
        "f9412d3c8847878a62379b9e65ac598541e3b5892582ced8c1584815e4bae29702b609ee84a9ed294c9c6f75f544a6ccd4a488b5e496f7e0c5354b85232874910112"
      ],
    };

    const proposalId = await input({ message: "Enter the proposal id:" });
    const proposalIdHex = BigInt(proposalId).toString(16).padStart(64, "0");
    //     console.log("proposalIdHex:", proposalIdHex);
    const proposalIdArray = Buffer.from(proposalIdHex, "hex");

//     const guardianSignaturesPda = await stakeConnection.postSignatures(
//       mainnetEthProposalResponse.signatures,
//     );
    const guardianSignaturesPda = new PublicKey(
      "WfU95bkYavZdQHi4dMJ17K7HtfzRqzduwHKAnLzkaiA", 
    );

    const simulationResult = await stakeConnection.addProposal(
      proposalIdArray,
      Buffer.from(mainnetEthProposalResponse.bytes, "hex"),
      guardianSignaturesPda,
      guardianSetIndex,
      false, // unoptimized
      true, // simulateOnly
    );

    console.log("Simulation result:", simulationResult);

//     await stakeConnection.addProposal(
//       proposalIdArray,
//       Buffer.from(mainnetEthProposalResponse.bytes, "hex"),
//       guardianSignaturesPda,
//       guardianSetIndex,
//       true
//     );
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
