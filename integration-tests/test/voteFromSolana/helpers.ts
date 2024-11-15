import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import { StakeConnection, wasm } from "../../../solana/app/StakeConnection";
import { WHTokenBalance } from "../../../solana/app/whTokenBalance";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, SOL_RPC_NODE } from "test/proposeFromSpoke/constants";
import type { Staking } from "../../../solana/target/types/staking";
import idl from "../../../solana/target/idl/staking.json"
import * as spl from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import {sleep} from "../createProposalOnSolana/helpers" 
import { PerChainQueryRequest, QueryRequest, QueryResponse, SolanaPdaQueryRequest, type QueryProxyQueryResponse, type SolanaPdaEntry } from "@wormhole-foundation/wormhole-query-sdk";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { ContractAddresses } from "test/config/addresses";
import { HubVotePoolAbi } from "abis";
import { formatQueryResponseSignaturesForViem } from "test/helpers";
import { createClients } from "test/config/clients";
import axios from "axios";

export const setupVotingOnSolana = async (votesFor : number) => {
  const client = new Connection(SOL_RPC_NODE);
  const wallet = new Wallet(DEPLOYER_AUTHORITY_KEYPAIR)
  const provider = new AnchorProvider(client, wallet)

  const program = new Program(idl as Staking, provider)

  const stakeConnection = await StakeConnection.createStakeConnection(
    client,
    wallet,
    new PublicKey(
      idl.address,
    ),
  );

  try{
    var createStakeAccountResponse = await stakeConnection.createStakeAccount();
    console.log("Created staking account")
    await sleep(20000); // Lag because of race condition in 'getAssociatedTokenAddressSync' call.
  }catch (e){
    console.log("Staking account already created")
  }

  
  // Transfer tokens to the staking account
  const fromTokenAccount = await spl.getAssociatedTokenAddressSync(
    stakeConnection.config.whTokenMint,
    DEPLOYER_AUTHORITY_KEYPAIR.publicKey,
  ); 

  var tokenAccountData = await spl.getAccount(client, fromTokenAccount);


  //var tokenAccountData = await spl.getAccount(client, toAccount.address);
  let userStakeAccountMetadataAddress =
    await stakeConnection.getStakeMetadataAddress(
      stakeConnection.userPublicKey(),
    );

  // Get the ATA for the token account
  var toAccount = await spl.getOrCreateAssociatedTokenAccount(client, wallet.payer, stakeConnection.config.whTokenMint, userStakeAccountMetadataAddress as PublicKey, true);

  // transfer tokens to the taking account
  await spl.transfer(client, wallet.payer, fromTokenAccount, toAccount.address, wallet.payer, votesFor)
  console.log("Transferred tokens to stake account");

  // Give time for the transfer to happen
  await sleep(5000);

  // Delegate the tokens to ourselves to be able to vote
  await stakeConnection.delegate(wallet.publicKey, WHTokenBalance.fromNumber(votesFor))
  console.log("Delegated tokens to account")

}

export const voteOnSolana = async(proposalId: Buffer, votesFor: number) => {
  const client = new Connection(SOL_RPC_NODE);
  const wallet = new Wallet(DEPLOYER_AUTHORITY_KEYPAIR)

  const stakeConnection = await StakeConnection.createStakeConnection(
    client,
    wallet,
    new PublicKey(
      idl.address,
    ),
  );

  let userStakeAccountMetadataAddress = await stakeConnection.getStakeMetadataAddress(
    stakeConnection.userPublicKey(),
  );

  let userStakeAccountCheckpointsAddress = await stakeConnection.   getStakeAccountCheckpointsAddressByMetadata(
      userStakeAccountMetadataAddress,
      true,
  );

  // Cast the vote
  await stakeConnection.castVote(
    proposalId,
    userStakeAccountCheckpointsAddress as PublicKey,
    new BN(0),
    new BN(votesFor),
    new BN(0),
    0 // Is this okay? I've seen it in other places
  );

  console.log("Casted vote on Solana")
}


export const sendVotesToEVMFromSolana = async (proposalId: Buffer) => {
 
  //const proposalId = Buffer.from("2dc89912a9d3d6174bfcce3275ee4ac17df994478b3a0461674d528c3c2e19a8", "hex"); 

  // Getting the CCQ response
  const PDAS: SolanaPdaEntry[] = [
    {
      programAddress: Uint8Array.from(
        bs58.decode(
          idl.address)
      ), // solana address
      seeds: [
        new Uint8Array(Buffer.from("proposal")),
        new Uint8Array(proposalId),
      ], // Use index zero in tilt.
    }];

    const solPdaReq = new SolanaPdaQueryRequest(
      "finalized",
      PDAS,
    );
    const nonce = 42;
    const query = new PerChainQueryRequest(1, solPdaReq);

    const request = new QueryRequest(nonce, [query]);
    const serialized = request.serialize();

    const serializedBytes = Buffer.from(serialized).toString("hex");

    const response = await axios.post<QueryProxyQueryResponse>("http://localhost:6069/v1/query", {bytes: serializedBytes}, {headers: {"X-API-Key" : "my_secret_key_3"}}); 

    console.log("Retrieved voting query response from Guardians")

    const { ethClient, ethWallet, account } = createClients();
  
  // EVM call to make 
  // https://github.com/wormhole-foundation/example-multigov/blob/c534a5a0894cc7a6af757f65a77629eda709afcd/evm/src/HubVotePool.sol#L123

  // Submit the spoke votes to the hub vote pool
  const sigs = formatQueryResponseSignaturesForViem(response.data.signatures);
  var data = await ethClient.simulateContract({
    address: ContractAddresses.HUB_VOTE_POOL,
    abi: HubVotePoolAbi,
    functionName: 'crossChainVote',
    args: ["0x" + response.data.bytes, sigs],
    account,
  });

  const hash = await ethWallet.writeContract({
    address: ContractAddresses.HUB_VOTE_POOL,
    abi: HubVotePoolAbi,
    functionName: 'crossChainVote',
    args: ["0x" + response.data.bytes, sigs],
    account,
  });

  console.log("Sent votes to EVM hub from Solana")

  await ethClient.waitForTransactionReceipt({ hash });

}
