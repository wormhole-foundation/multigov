# Staking Program

This repository contains the Wormhole MultiGov Solana Staking Program.

## Prerequisites

Before you begin, ensure you have met the following requirements:

- Node.js v20.10.0
- Solana CLI v1.18.20
- Anchor v0.30.1
- Rust compiler 1.80.1
- Docker

## Building the Project

You can create a verifiable build of the project by running the following command:

```bash
./scripts/build_verifiable_staking_program.sh
```

If you want to create a verifiable build for testing, use the -t option:

```bash
./scripts/build_verifiable_staking_program.sh -t
```

The result of the build will be `target` folder.

## Run tests

To run the tests locally use the following command:

```bash
npm run test
```

To run the tests with verifiable builds:

```bash
npm run test:ci
```
