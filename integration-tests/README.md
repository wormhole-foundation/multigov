# Integration Tests

These tests verify the MultiGov cross-chain governance functionality between different chains in a local Wormhole (Tilt) development environment.

## Prerequisites

- [Bun](https://bun.sh) v1.1.7 or later
- [Docker](https://docs.docker.com/desktop/release-notes/#4280) version 4.28.0
- [Go](https://golang.org/dl/) >= 1.21.9 (latest minor release is recommended)
- [Tilt](http://tilt.dev/) >= 0.20.8

## Setup

1. Install dependencies:

```bash
bun install
```

2. Clone and start the Wormhole development environment:

```bash
# Clone the Wormhole repo
git clone https://github.com/wormhole-foundation/wormhole.git
cd wormhole

# Start the development environment
tilt up -- --evm2=true --query_server=true
```

Wait for the Tilt environment to fully initialize. This may take several minutes as it sets up multiple chains and services.

3. Deploy the contracts:

```bash
# Navigate to the evm directory in this project
cd evm

# Set the ETHDEVNET_MNEMONIC in .env in the `evm` and `integration-tests` folders to the one specified in the wormhole repo
ETHDEVNET_MNEMONIC='blah'

# Deploy hub contracts on EthDevnet1
forge script script/DeployHubContractsEthDevnet1.sol:DeployHubContractsEthDevnet1 --rpc-url http://localhost:8545 --broadcast --via-ir

# Deploy spoke contracts on EthDevnet2
forge script script/DeploySpokeContractsEthDevnet2.sol:DeploySpokeContractsEthDevnet2 --rpc-url http://localhost:8546 --broadcast --via-ir
```

Note: For fresh deployments in the devnet environment, simply restart the relevant process.

## Running Tests

To run all integration tests:

```bash
bun test
```

## Test Structure

The integration tests verify:

- Cross-chain proposal creation
- Vote aggregation across chains
- Cross-chain execution of passed proposals

This project uses [Bun](https://bun.sh) as the JavaScript runtime.
