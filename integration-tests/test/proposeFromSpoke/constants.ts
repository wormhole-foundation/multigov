import { PublicKey } from "@solana/web3.js";
import { web3 } from "@coral-xyz/anchor";

export const STAKING_ADDRESS = new PublicKey(
  "8t5PooRwQTcmN7BP5gsGeWSi3scvoaPqFifNi2Bnnw4g",
);

export const CORE_BRIDGE_ADDRESS = new PublicKey(
  "3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5",
);

/// Wormhole Hub Proposal Metadata Contract (sepolia ethereum address)
export const hubProposalMetadata = new Uint8Array([
  0x26, 0xc7, 0x36, 0x62, 0x63, 0x3b, 0xd0, 0xd4, 0xa6, 0xba, 0x23, 0x1a, 0x10,
  0x01, 0xbb, 0xbc, 0xed, 0x8d, 0x2b, 0x21,
]);

/// Wormhole Hub Chain ID
export const hubChainId = 2;

export const DEPLOYER_AUTHORITY_KEYPAIR = web3.Keypair.fromSecretKey(
    new Uint8Array([
        14, 173, 153, 4, 176, 224, 201, 111, 32, 237, 183, 185, 159, 247, 22, 161, 89,
        84, 215, 209, 212, 137, 10, 92, 157, 49, 29, 192, 101, 164, 152, 70, 87, 65,
        8, 174, 214, 157, 175, 126, 98, 90, 54, 24, 100, 177, 247, 77, 19, 112, 47,
        44, 165, 109, 233, 102, 14, 86, 109, 29, 134, 145, 132, 141
      ])
  );

export const ETH_PRIVATE_KEY = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
export const SOL_RPC_NODE = "http://localhost:8899"
export const ETH1_RPC_NODE = "http://localhost:8545" 


// Ethereum deployments
export const HUB_ADDRESS = "0x4bf3a7dfb3b76b5b3e169ace65f888a4b4fca5ee"