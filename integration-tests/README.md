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

## Contract ABIs

The integration tests require up-to-date ABIs from the smart contracts. To generate/update the ABIs:

```bash
# From the project root
cd integration-tests/
bun run generate-abis
```

This will:

- Read the contract artifacts from `evm/out/`
- Generate json ABI files in `evm/abis/`

You will then need to update the `integration-tests/abis` folder with all of these files, updating them to be .ts files and exporting each abi as default and `as const`.

Remember to regenerate ABIs whenever you make changes to the smart contracts.

## Running Tests

The tests set up the tilt environment for cross-chain governance testing:

1. Deploys all contracts
2. Sets up the deployer account with delegated tokens
3. Handles any registrations

To run all integration tests when running locally:

```bash
bun test
```

## Test Structure

The integration tests verify:

- Cross-chain proposal creation
- Vote aggregation across chains
- Cross-chain execution of passed proposals
