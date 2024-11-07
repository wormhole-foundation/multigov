#!/bin/bash

# List of main contracts
main_contracts=(
    "HubEvmSpokeAggregateProposer"
    "HubEvmSpokeVoteDecoder"
    "HubGovernor"
    "HubMessageDispatcher"
    "HubProposalExtender"
    "HubProposalMetadata"
    "HubSolanaMessageDispatcher"
    "HubSolanaSpokeVoteDecoder"
    "HubVotePool"
    "SpokeAirlock"
    "SpokeMessageExecutor"
    "SpokeMetadataCollector"
    "SpokeVoteAggregator"
    "WormholeDispatcher"
    "ERC20VotesFake"
    "TimelockController"
    "ERC1967Proxy"
)

# Create a directory for the ABIs if it doesn't exist
mkdir -p abis

# Loop through each main contract and generate its ABI
for contract in "${main_contracts[@]}"
do
    forge inspect $contract abi > abis/${contract}_abi.json
    echo "Generated ABI for $contract"
done

echo "ABIs for main contracts generated in the 'abis' directory."