import { EthCallData, EthCallWithFinalityQueryRequest, PerChainQueryRequest, QueryRequest, signaturesToEvmStruct } from "@wormhole-foundation/wormhole-query-sdk";
import axios from "axios";
import { ethers } from "ethers";

const API_KEY = "b3f5bde4-b6d3-46ec-b882-8b9a2d126b5c";
const rpc = "https://1rpc.io/sepolia";

async function getWormholeQuery(chain: number, latestBlock: number, calldata: EthCallData) {
    const request = new QueryRequest(
      0, // nonce
      [
        new PerChainQueryRequest(
          chain, // Ethereum Wormhole Chain ID
          new EthCallWithFinalityQueryRequest(latestBlock, "finalized", [calldata])
        ),
      ]
    ).serialize();
  
    return (await axios.post(
      "https://testnet.query.wormhole.com/v1/query",
      { bytes: Buffer.from(request).toString("hex") },
      { headers: { "X-API-Key": API_KEY } },
    )).data;
  }

function encodeSignature(signature: string): string {
return ethers.id(signature).substring(0, 10)
}

function encodeCalldata(signature: string, parameters: string): string {
return signature + parameters.substring(2);
}

async function getLatestBlock(rpc: string): Promise<number> {
    return (
      await axios.post(rpc, {
        method: "eth_getBlockByNumber",
        params: ["finalized", false],
        id: 1,
        jsonrpc: "2.0",
      })
    ).data?.result?.number;
  }

function uint256ToBuffer(uint256) {
    const bigIntValue = BigInt(uint256);
    const buffer = Buffer.alloc(32);
    let hexValue = bigIntValue.toString(16).padStart(64, '0');
    buffer.write(hexValue, 'hex');
    return buffer;
}

async function proposal(proposalId) {

    const chain = 10002; // Sepolia Wormhole Chain ID
    const contractAddress= "0x26c73662633bd0d4a6ba231a1001bbbced8d2b21" //HubProposalMetadata

    const encodedSignature = encodeSignature("getProposalMetadata(uint256)");
    const encodedParameters = new ethers.AbiCoder().encode(
      ["uint256"],
      [proposalId]
    );

    const calldata: EthCallData = {
      to: contractAddress,
      data: encodeCalldata(encodedSignature, encodedParameters),
    };

    const latestBlock = await getLatestBlock(rpc)

    const result = await getWormholeQuery(chain, latestBlock, calldata);

    console.log(result);

    console.log(`You can now call addProposal with the following parameters:\n_queryResponseRaw: 0x${result.bytes}\n_signatures: ${JSON.stringify(signaturesToEvmStruct(result.signatures))}`);
  }

const proposalId = "107524253878028098533770440336162529987916725531746959312330912271441391631104";
proposal(proposalId);
console.log("proposalIdHex:", uint256ToBuffer(proposalId).toString('hex'));