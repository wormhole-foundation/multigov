#
# Docker image to generate a deterministic build of the Wormhole MultiGov Solana Staking Program
# This image extends projectserum/build which is based on backpackapp/build
# but with a specific version of the Solana CLI and Anchor CLI.
#

FROM backpackapp/build:v0.30.1

ARG TEST=false
ENV TEST_ENV=$TEST
WORKDIR /workspace

COPY . .

CMD ["bash", "-c", \
        "if [ \"$TEST_ENV\" = \"true\" ]; then anchor build ; else anchor build; fi && if [ \"$TEST_ENV\" = \"true\" ]; then chmod -R 777 target/deploy; fi"]
