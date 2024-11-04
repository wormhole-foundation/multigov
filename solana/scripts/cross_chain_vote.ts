import { ethers } from 'ethers';
import * as fs from 'fs';
import 'dotenv/config';import {
    signaturesToEvmStruct
  } from "@wormhole-foundation/wormhole-query-sdk";

const contractAddress = '0x4ee552355d4720a4dce7ff022eb7490575f50567'; // HubVotePool
const contractABIPath = './script/ABI/HubVotePool.json';

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.SEPOLIA_RPC_URL;

const contractABI = JSON.parse(fs.readFileSync(contractABIPath, 'utf8'));

async function crossChainVoteSolana(): Promise<void> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey!, provider);
  
      const contract = new ethers.Contract(contractAddress, contractABI, wallet);
  
      const rawdata = "0x0100009dcd01ec1d41ad646446c853454e9cd18238494971f51ae0621149ccc286bc530a5c7ee365240883f9fd821d913a20d35b6a7bc6a84536db6424c77e314fe3dc0100000084010000002a01000105000000770000000966696e616c697a656400000000000000000000000000000000000000000000000001751765ad93a0f056374573b9e0ff7fd4b510fc14ba3be38d7b386e56e69e7d45020000000870726f706f73616c00000020edb8922e53177122af0644b1fb9b3ef076865f205ecac4b9f98b0f66ebc9bb0001000105000000cf00000000140c5bc40006259fae9fcd0005dde1b2f3d19cabb8afab3805f18ec0e6f490c5041698eaf597bdf5c78e2e3201f41d481f6d865a4083bd98e31fd5df0166a7603ba19a95d60c5ba04b70291bd7ff0000000000153d80ffffffffffffffff00751765ad93a0f056374573b9e0ff7fd4b510fc14ba3be38d7b386e56e69e7d4500000048c2567bac921cbff4edb8922e53177122af0644b1fb9b3ef076865f205ecac4b9f98b0f66ebc9bb000a0000000000000014000000000000000c000000000000000e00216700000000";
  
      const guardianSignatures = signaturesToEvmStruct(
          ['edde958dd30108ac7a89ad8cc399e36a5a24ad8bd31ecade9be583b2d367e5fc0426714e6d541a386e2839ae7aad802913e5443826150126a0692af0e1e3e3490100'],
      );
  
      console.log('Solana Cross Chain Vote...');
      const tx = await contract.crossChainVote(rawdata, guardianSignatures);
      console.log(tx);

    } catch (error) {
      console.error(error);
    }
  }
  
  crossChainVoteSolana();