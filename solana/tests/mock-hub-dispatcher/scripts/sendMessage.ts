import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { ContractFactory } from "ethers";
import { NodeHttpTransport } from "@improbable-eng/grpc-web-node-http-transport";
import {
  ChainId,
  tryNativeToHexString,
  getSignedVAAWithRetry,
} from "@certusone/wormhole-sdk";
import { readFileSync } from "fs";
import bs58 from "bs58";

// Load environment variables from .env file
dotenv.config();

async function main() {
  // Retrieve private key and RPC URLs from environment variables
  const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
  const RPC_URL = process.env.RPC_URL || "";
  const WORMHOLE_RPC = process.env.WORMHOLE_RPC || "";

  if (!PRIVATE_KEY || !RPC_URL || !WORMHOLE_RPC) {
    console.error(
      "Please set PRIVATE_KEY, RPC_URL, and WORMHOLE_RPC in your .env file",
    );
    process.exit(1);
  }

  // Connect to the Ethereum network
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Wallet address:", wallet.address);

  // ABI and bytecode of the simplified contract
  const SimpleDispatcherABI = [
    {
      inputs: [
        {
          internalType: "address",
          name: "_wormhole",
          type: "address",
        },
        {
          internalType: "uint8",
          name: "_dispatchConsistencyLevel",
          type: "uint8",
        },
      ],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "messageId",
          type: "uint256",
        },
        {
          indexed: false,
          internalType: "bytes",
          name: "payload",
          type: "bytes",
        },
      ],
      name: "MessageDispatched",
      type: "event",
    },
    {
      inputs: [
        {
          internalType: "uint16",
          name: "_wormholeChainId",
          type: "uint16",
        },
        {
          components: [
            {
              internalType: "bytes32",
              name: "programId",
              type: "bytes32",
            },
            {
              components: [
                {
                  internalType: "bytes32",
                  name: "pubkey",
                  type: "bytes32",
                },
                {
                  internalType: "bool",
                  name: "isSigner",
                  type: "bool",
                },
                {
                  internalType: "bool",
                  name: "isWritable",
                  type: "bool",
                },
              ],
              internalType: "struct SolanaAccountMeta[]",
              name: "accounts",
              type: "tuple[]",
            },
            {
              internalType: "bytes",
              name: "data",
              type: "bytes",
            },
          ],
          internalType: "struct SolanaInstruction[]",
          name: "instructions",
          type: "tuple[]",
        },
      ],
      name: "dispatch",
      outputs: [],
      stateMutability: "payable",
      type: "function",
    },
    {
      inputs: [],
      name: "dispatchConsistencyLevel",
      outputs: [
        {
          internalType: "uint8",
          name: "",
          type: "uint8",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "nextMessageId",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "wormhole",
      outputs: [
        {
          internalType: "contract IWormhole",
          name: "",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];

  const SimpleDispatcherBytecode =
    "0x60806040523480156200001157600080fd5b5060405162000da338038062000da3833981810160405281019062000037919062000142565b816000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555080600060146101000a81548160ff021916908360ff160217905550505062000189565b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000620000cc826200009f565b9050919050565b620000de81620000bf565b8114620000ea57600080fd5b50565b600081519050620000fe81620000d3565b92915050565b600060ff82169050919050565b6200011c8162000104565b81146200012857600080fd5b50565b6000815190506200013c8162000111565b92915050565b600080604083850312156200015c576200015b6200009a565b5b60006200016c85828601620000ed565b92505060206200017f858286016200012b565b9150509250929050565b610c0a80620001996000396000f3fe60806040526004361061003f5760003560e01c806379d30fa81461004457806384acd1bb1461006f578063b48648d51461009a578063eefbf17e146100b6575b600080fd5b34801561005057600080fd5b506100596100e1565b60405161006691906102c0565b60405180910390f35b34801561007b57600080fd5b506100846100f4565b604051610091919061035a565b60405180910390f35b6100b460048036038101906100af919061041e565b610118565b005b3480156100c257600080fd5b506100cb61029e565b6040516100d89190610497565b60405180910390f35b600060149054906101000a900460ff1681565b60008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b6000828290501161015e576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016101559061050f565b60405180910390fd5b60006001548484849050858560405160200161017e959493929190610978565b604051602081830303815290604052905060008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663b19a437e34600085600060149054906101000a900460ff166040518563ffffffff1660e01b815260040161020093929190610a90565b60206040518083038185885af115801561021e573d6000803e3d6000fd5b50505050506040513d601f19601f820116820180604052508101906102439190610b0e565b90506001547f404ed8984bb5212ba28cae0f5f3bbaab866c544fbfd7c5d71809f9ebd607b511836040516102779190610b3b565b60405180910390a26001600081548092919061029290610b8c565b91905055505050505050565b60015481565b600060ff82169050919050565b6102ba816102a4565b82525050565b60006020820190506102d560008301846102b1565b92915050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b600061032061031b610316846102db565b6102fb565b6102db565b9050919050565b600061033282610305565b9050919050565b600061034482610327565b9050919050565b61035481610339565b82525050565b600060208201905061036f600083018461034b565b92915050565b600080fd5b600080fd5b600061ffff82169050919050565b6103968161037f565b81146103a157600080fd5b50565b6000813590506103b38161038d565b92915050565b600080fd5b600080fd5b600080fd5b60008083601f8401126103de576103dd6103b9565b5b8235905067ffffffffffffffff8111156103fb576103fa6103be565b5b602083019150836020820283011115610417576104166103c3565b5b9250929050565b60008060006040848603121561043757610436610375565b5b6000610445868287016103a4565b935050602084013567ffffffffffffffff8111156104665761046561037a565b5b610472868287016103c8565b92509250509250925092565b6000819050919050565b6104918161047e565b82525050565b60006020820190506104ac6000830184610488565b92915050565b600082825260208201905092915050565b7f456d707479496e737472756374696f6e53657400000000000000000000000000600082015250565b60006104f96013836104b2565b9150610504826104c3565b602082019050919050565b60006020820190508181036000830152610528816104ec565b9050919050565b6105388161037f565b82525050565b600082825260208201905092915050565b6000819050919050565b6000819050919050565b61056c81610559565b811461057757600080fd5b50565b60008135905061058981610563565b92915050565b600061059e602084018461057a565b905092915050565b6105af81610559565b82525050565b600080fd5b600080fd5b600080fd5b600080833560016020038436030381126105e1576105e06105bf565b5b83810192508235915060208301925067ffffffffffffffff821115610609576106086105b5565b5b60608202360383131561061f5761061e6105ba565b5b509250929050565b600082825260208201905092915050565b6000819050919050565b60008115159050919050565b61065781610642565b811461066257600080fd5b50565b6000813590506106748161064e565b92915050565b60006106896020840184610665565b905092915050565b61069a81610642565b82525050565b606082016106b1600083018361058f565b6106be60008501826105a6565b506106cc602083018361067a565b6106d96020850182610691565b506106e7604083018361067a565b6106f46040850182610691565b50505050565b600061070683836106a0565b60608301905092915050565b600082905092915050565b6000606082019050919050565b60006107368385610627565b935061074182610638565b8060005b8581101561077a576107578284610712565b61076188826106fa565b975061076c8361071d565b925050600181019050610745565b5085925050509392505050565b600080833560016020038436030381126107a4576107a36105bf565b5b83810192508235915060208301925067ffffffffffffffff8211156107cc576107cb6105b5565b5b6001820236038313156107e2576107e16105ba565b5b509250929050565b600082825260208201905092915050565b82818337600083830152505050565b6000601f19601f8301169050919050565b600061082783856107ea565b93506108348385846107fb565b61083d8361080a565b840190509392505050565b60006060830161085b600084018461058f565b61086860008601826105a6565b5061087660208401846105c4565b858303602087015261088983828461072a565b9250505061089a6040840184610787565b85830360408701526108ad83828461081b565b925050508091505092915050565b60006108c78383610848565b905092915050565b6000823560016060038336030381126108eb576108ea6105bf565b5b82810191505092915050565b6000602082019050919050565b6000610910838561053e565b9350836020840285016109228461054f565b8060005b8781101561096657848403895261093d82846108cf565b61094785826108bb565b9450610952836108f7565b925060208a01995050600181019050610926565b50829750879450505050509392505050565b600060808201905061098d6000830188610488565b61099a602083018761052f565b6109a76040830186610488565b81810360608301526109ba818486610904565b90509695505050505050565b6000819050919050565b600063ffffffff82169050919050565b60006109fb6109f66109f1846109c6565b6102fb565b6109d0565b9050919050565b610a0b816109e0565b82525050565b600081519050919050565b600082825260208201905092915050565b60005b83811015610a4b578082015181840152602081019050610a30565b60008484015250505050565b6000610a6282610a11565b610a6c8185610a1c565b9350610a7c818560208601610a2d565b610a858161080a565b840191505092915050565b6000606082019050610aa56000830186610a02565b8181036020830152610ab78185610a57565b9050610ac660408301846102b1565b949350505050565b600067ffffffffffffffff82169050919050565b610aeb81610ace565b8114610af657600080fd5b50565b600081519050610b0881610ae2565b92915050565b600060208284031215610b2457610b23610375565b5b6000610b3284828501610af9565b91505092915050565b60006020820190508181036000830152610b558184610a57565b905092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b6000610b978261047e565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8203610bc957610bc8610b5d565b5b60018201905091905056fea2646970667358221220a0c37c74a6e92afd704751b3f82cb0b14f18ecb876bab5e15cefb1b5eb820d4364736f6c63430008170033"; // Insert the bytecode of your contract here

  // Load the contract
  const factory = new ContractFactory(
    SimpleDispatcherABI,
    SimpleDispatcherBytecode,
    wallet,
  );

  // Address of the Wormhole contract on the Goerli testnet
  const wormholeAddress = "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78"; // Wormhole contract address on Goerli

  // Deploy the contract
  console.log("Deploying SimpleDispatcher contract...");
  const dispatcher = await factory.deploy(wormholeAddress, 1); // 1 is the consistencyLevel
  await dispatcher.deployed();
  console.log("SimpleDispatcher deployed at address:", dispatcher.address);

  // Prepare data for sending the message
  const wormholeChainId = 1; // Chain ID for Solana in Wormhole (1 for testnet)

  // Insert your data here
  const recipientProgramIdBase58 =
    "5Vry3MrbhPCBWuviXVgcLQzhQ1mRsVfmQyNFuDgcPUAQ"; // Solana System Program ID in Base58
  const recipientPubkeyBase58 = "EDP1iJnHAxnTD9WeBuhFZ441TMWD4Uyhm5UqFjmBgp8A"; // Replace with your recipient's Solana public key in Base58

  // Convert Base58 to bytes
  const recipientProgramIdBytes = bs58.decode(recipientProgramIdBase58);
  const recipientPubkeyBytes = bs58.decode(recipientPubkeyBase58);

  // Convert bytes to hex strings
  const recipientProgramId =
    "0x" + Buffer.from(recipientProgramIdBytes).toString("hex");
  const recipientPubkey =
    "0x" + Buffer.from(recipientPubkeyBytes).toString("hex");

  // Validate the recipient addresses
  if (!ethers.utils.isHexString(recipientProgramId, 32)) {
    console.error("recipientProgramId must be a 32-byte hex string");
    process.exit(1);
  }

  if (!ethers.utils.isHexString(recipientPubkey, 32)) {
    console.error("recipientPubkey must be a 32-byte hex string");
    process.exit(1);
  }

  // Create the instruction data using AbiCoder
  const abi = ethers.utils.defaultAbiCoder;

  const lamports = 1000; // Amount to transfer (example)

  // Solana's SystemProgram::Transfer instruction expects the amount as a 64-bit unsigned integer (big-endian)
  const instructionData = abi.encode(["uint64"], [lamports]);

  const instruction = {
    programId: recipientProgramId, // System Program ID as hex string
    accounts: [
      {
        pubkey: recipientPubkey, // Recipient's Solana public key as hex string
        isSigner: false,
        isWritable: true,
      },
    ],
    data: instructionData, // Encoded transfer amount
  };

  const instructions = [instruction];

  // Call the dispatch function
  const feeInEther = "0.01"; // Adjust based on Wormhole's fee requirements
  console.log(
    `Sending message through Wormhole with a fee of ${feeInEther} ETH...`,
  );
  const tx = await dispatcher.dispatch(wormholeChainId, instructions, {
    gasLimit: 500000,
  });

  console.log("Transaction sent, hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt.blockNumber);

  // Retrieve the sequence from the Wormhole event logs
  const wormholeInterface = new ethers.utils.Interface([
    "event LogMessagePublished(address indexed sender, uint64 sequence, uint32 nonce, bytes payload, uint8 consistencyLevel)",
  ]);

  let sequence = null;
  for (const log of receipt.logs) {
    try {
      const parsedLog = wormholeInterface.parseLog(log);
      if (parsedLog && parsedLog.name === "LogMessagePublished") {
        sequence = parsedLog.args.sequence.toString();
        console.log("Found sequence:", sequence);
        break;
      }
    } catch (e) {
      // Skip logs that do not match the Wormhole event
    }
  }

  if (!sequence) {
    console.error("Failed to retrieve sequence from transaction");
    process.exit(1);
  }

  // Obtain the VAA from Wormhole
  const emitterAddress = tryNativeToHexString(dispatcher.address, 10002);

  console.log("Fetching VAA from Wormhole...");
  const { vaaBytes } = await getSignedVAAWithRetry(
    [WORMHOLE_RPC],
    10002, // Chain ID for Ethereum
    emitterAddress,
    sequence,
    {
      transport: NodeHttpTransport(),
    },
  );

  console.log("VAA retrieved, length:", vaaBytes.length);

  // Output the VAA in hex format
  console.log("VAA (in hex):", Buffer.from(vaaBytes).toString("hex"));

  // You can save the VAA to a file or pass it to your Solana program
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("An error occurred:", error);
    process.exit(1);
  });
