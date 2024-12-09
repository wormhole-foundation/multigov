# First stage: Build contracts
FROM --platform=linux/amd64 ghcr.io/foundry-rs/foundry@sha256:8b843eb65cc7b155303b316f65d27173c862b37719dc095ef3a2ef27ce8d3c00 as foundry

# Only copy what's needed for forge build
WORKDIR /app/evm
COPY evm/foundry.toml ./foundry.toml
COPY evm/lib ./lib
COPY evm/src ./src
RUN forge clean && forge build
RUN ls -la

# Second stage: Setup test environment
FROM oven/bun:1 AS base
WORKDIR /app
# Copy package files first for better caching
COPY integration-tests/package.json integration-tests/bun.lockb ./
RUN bun install --frozen-lockfile

# Copy test files and artifacts
COPY integration-tests/test ./test
COPY integration-tests/abis ./abis
COPY integration-tests/artifacts ./artifacts
COPY --from=foundry /app/evm/out ./out

# Copy tsconfig and other config files
COPY integration-tests/tsconfig.json ./
COPY integration-tests/biome.json ./

