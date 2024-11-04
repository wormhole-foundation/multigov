import { ethers } from 'ethers';
import * as fs from 'fs';
import 'dotenv/config';import {
    signaturesToEvmStruct
  } from "@wormhole-foundation/wormhole-query-sdk";

const HubGovernorAddress = '0xbf56492fc04ec0b09b194cfca62a65f8167cd363'; // HubGovernor
const HubGovernorAbi = './script/ABI/HubGovernor.json';

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.SEPOLIA_RPC_URL;

const contractABI = JSON.parse(fs.readFileSync(HubGovernorAbi, 'utf8'));

function uint256ToBuffer(uint256) {
    const bigIntValue = BigInt(uint256);
    const buffer = Buffer.alloc(32);
    let hexValue = bigIntValue.toString(16).padStart(64, '0');
    buffer.write(hexValue, 'hex');
    return buffer;
}

async function propose(): Promise<void> {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey!, provider);
      const contract = new ethers.Contract(HubGovernorAddress, contractABI, wallet);
      
      const proposal_payload = [["0x857f07b0D8E81785F7c02f6b64E8F3eBEDDeB9bB"], [0], ["0x"], "test_03 test_03"];
      console.log('Creating a new proposal...');
      const proposalId = await contract.propose.staticCall(...proposal_payload);
      const tx = await contract.propose(...proposal_payload);
      console.log(tx);
      console.log("proposalId:", proposalId);
      console.log("proposalIdHex:", uint256ToBuffer(proposalId).toString('hex'));

    } catch (error) {
      console.error(error);
    }
  }
  
  propose();