import { createArbitraryProposalData, createProposalViaAggregateProposer, createProposalViaHubGovernor, getProposal, getVoteStart } from 'test/helpers';
import { createProposalOnSpoke, getProposalOnSpoke } from '../createProposalOnSpoke/helpers';
import { Wallet, AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { DEPLOYER_AUTHORITY_KEYPAIR, HUB_ADDRESS, SOL_RPC_NODE, SOLANA_SPOKE_ADDRESS } from "../proposeFromSpoke/constants.ts";
import idl from "../../../solana/target/idl/staking.json"
import type {Staking} from "../../../solana/target/types/staking.ts"
import { StakeConnection } from "../../../solana/app/StakeConnection.ts";
import { createClients } from "test/config/clients.ts";
import { queryHubProposalMetadata } from "test/createProposalOnSpoke/helpers.ts";
import { getWormholeBridgeData } from "../../../solana/app/helpers/wormholeBridgeConfig.ts";


export const createProposalOnSolana = async () => {
    console.log("Starting create proposal on Solana....")

    const proposalData = await createArbitraryProposalData();

    console.log("Before create proposal...")
    const proposalId = await createProposalViaHubGovernor(proposalData);
    console.log("After create proposal...")
    
    //const proposalId = 64486728149589802134402046581700694611161572255902220899113581080654785109148n;

    console.log("Created Proposal ID:", proposalId.toString(16));

    const { ethClient, eth2Client, ethWallet, account } = createClients();
    
    const currentBlock = await ethClient.getBlock();
    const queryResponse = await queryHubProposalMetadata({
        proposalId,
        proposalCreatedBlock: currentBlock.number,
    });

    console.log("Obtain CCQ data for proposal")

    const client = new Connection(SOL_RPC_NODE);
    const wallet = new Wallet(DEPLOYER_AUTHORITY_KEYPAIR)

    // Prepare signatures for calling PostSig
    var ccqData = queryResponse.queryResponseBytes.substring(2);
    var sigs = queryResponse.queryResponseSignatures;
    var byteSigs: string[] = [];
    for( const sig of sigs) {
        var hex_data = sig.r.substring(2);
        hex_data = hex_data + sig.s.substring(2)

        if(sig.v == 27){
            hex_data = hex_data + "00"
        }
        else{ // 28
            hex_data = hex_data + "01"
        }

        hex_data = hex_data + "00" //sig.guardianIndex.toString(16);
        byteSigs.push(hex_data)
    }

    const stakeConnection = await StakeConnection.createStakeConnection(
        client,
        wallet,
        new PublicKey(
            idl.address,
        ),
    );

    const CORE_BRIDGE_ADDRESS = new PublicKey(
        "Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o",
    );
    const info = await getWormholeBridgeData(client, CORE_BRIDGE_ADDRESS);

    // Add signatures for the call
    const signaturesKeypair = Keypair.generate();
    await stakeConnection.postSignatures(
        byteSigs,
        signaturesKeypair,
    );
    console.log("Posted signatures to Solana for CCQ")

    await sleep(5000);

    // Query to ensure that the sigs were posted
    const bufferProposalId = Buffer.from(proposalId.toString(16), "hex");
    await stakeConnection.addProposal(
        bufferProposalId,
        Uint8Array.from(Buffer.from(ccqData, "hex")),
        signaturesKeypair.publicKey,
        info.guardianSetIndex,
        false,
        CORE_BRIDGE_ADDRESS
    );
    console.log("Added proposal to Solana")

    // Sleep to allow this proposal to be added. Otherwise, we run into a race condition.
    await sleep(30000);
    const proposalDataSolana = await stakeConnection.fetchProposalAccountData(bufferProposalId);

    console.log("Getting proposal")

    return [proposalId, proposalDataSolana];
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));