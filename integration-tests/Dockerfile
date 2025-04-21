# First stage: Build contracts
FROM --platform=linux/amd64 ghcr.io/foundry-rs/foundry as foundry

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

# Copy all integration-tests files
COPY integration-tests/ ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy foundry output
COPY --from=foundry /app/evm/out ./out

