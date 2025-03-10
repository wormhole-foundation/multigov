#!/usr/bin/env bash

set -euo pipefail

# Root of the repository
REPO_ROOT=$(git rev-parse --show-toplevel)

# Default value for TEST
TEST=false

# Parse command-line arguments
# -t: build the Wormhole staking program for tests
while getopts "t" opt; do
    case ${opt} in
    t)
        TEST=true
        ;;
    \?)
        echo "Invalid option: -$OPTARG" 1>&2
        exit 1
        ;;
    esac
done

if [ "$TEST" = "true" ]; then
    echo "Building the image for the Wormhole staking program test"
    docker build --platform linux/amd64 --build-arg TEST=true -t wh-staking-build-test -f "$REPO_ROOT"/solana/Dockerfile "$REPO_ROOT"/solana
else
    echo "Building the image for the Wormhole staking program production"
    docker build --platform linux/amd64 -t wh-staking-build -f "$REPO_ROOT"/solana/Dockerfile "$REPO_ROOT"/solana
fi

if [ "$TEST" = "true" ]; then
    echo "Building the Wormhole staking program test"
    docker run --platform linux/amd64 --rm -v "$REPO_ROOT"/solana/target:/workspace/target wh-staking-build-test
else
    echo "Building the Wormhole staking program"
    docker run --platform linux/amd64 --rm -v "$REPO_ROOT"/solana/target:/workspace/target wh-staking-build
fi

echo "Successfully built the Wormhole staking program."
echo "The artifacts are available at $REPO_ROOT/solana/target"

CHECKSUM=$(sha256sum $REPO_ROOT/solana/target/deploy/staking.so | awk '{print $1}')
echo "sha256sum of the Wormhole staking program: $CHECKSUM"
