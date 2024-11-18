import { Keypair } from "@solana/web3.js";
import assert from "assert";
import {
  ANCHOR_CONFIG_PATH,
  getPortNumber,
  makeTestConfig,
  newUserStakeConnection,
  readAnchorConfig,
  standardSetup,
  sleep,
} from "./utils/before";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import BN from "bn.js";
import path from "path";
import {
  createProposalQueryResponseBytes,
} from "./utils/api_utils";
import {
  StakeConnection,
  WHTokenBalance,
  TEST_CHECKPOINTS_ACCOUNT_LIMIT,
  MAX_VOTE_WEIGHT_WINDOW_LENGTH,
} from "../app";
import { CheckpointAccount } from "../app/checkpoints";
import crypto from "crypto";
import {
  QueryProxyMock,
} from "@wormhole-foundation/wormhole-query-sdk";

const portNumber = getPortNumber(path.basename(__filename));

describe("cast_vote with max checkpoints count in two checkpoints accounts", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const governanceAuthority = new Keypair();

  const VOTE_WEIGHT_WINDOW_LENGTH = MAX_VOTE_WEIGHT_WINDOW_LENGTH;
  const LARGE_CHECKPOINTS_ACCOUNT_LIMIT = VOTE_WEIGHT_WINDOW_LENGTH - 3;

  let stakeConnection: StakeConnection;
  let controller;
  let owner;

  const confirm = async (signature: string): Promise<string> => {
    const block =
      await stakeConnection.provider.connection.getLatestBlockhash();
    await stakeConnection.provider.connection.confirmTransaction({
      signature,
      ...block,
    });

    return signature;
  };

  after(async () => {
    controller.abort();
  });

  before(async () => {
    const config = readAnchorConfig(ANCHOR_CONFIG_PATH);
    ({ controller, stakeConnection } = await standardSetup(
      portNumber,
      config,
      whMintAccount,
      whMintAuthority,
      governanceAuthority,
      makeTestConfig(
        whMintAccount.publicKey,
        whMintAuthority.publicKey,
        LARGE_CHECKPOINTS_ACCOUNT_LIMIT,
      ),
      WHTokenBalance.fromString("1000"),
      VOTE_WEIGHT_WINDOW_LENGTH
    ));
    owner = stakeConnection.provider.wallet.publicKey;
  });

  it("should successfully castVote if the vote weight windows no more than MAX_VOTE_WEIGHT_WINDOW_LENGTH", async () => {
    await stakeConnection.program.methods
      .createStakeAccount()
      .accounts({
        mint: whMintAccount.publicKey,
      })
      .rpc();
    let stakeAccountMetadataAddress =
      await stakeConnection.getStakeMetadataAddress(
        stakeConnection.userPublicKey(),
      );
    let stakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    const totalCheckpointsCount = LARGE_CHECKPOINTS_ACCOUNT_LIMIT - 1;
    const checkpointsCountPerInstruction = 31;
    let currentTimestamp = Math.floor(Date.now() / 1000);
    let checkpointsCountBN = new BN(checkpointsCountPerInstruction);
    const firstTimestampBN = new BN(currentTimestamp - totalCheckpointsCount + 10);
    const firstValueBN = new BN(100);
    for (let i = 0; i <= (totalCheckpointsCount / checkpointsCountPerInstruction); i++) {
      if (totalCheckpointsCount < (i + 1) * checkpointsCountPerInstruction) {
        checkpointsCountBN = new BN(totalCheckpointsCount - i * checkpointsCountPerInstruction);
      }

      if (checkpointsCountBN > new BN(0)) {
//         console.log("addCheckpointsBulk i:", i);
        await stakeConnection.program.methods
          .addCheckpointsBulk(checkpointsCountBN, firstTimestampBN, firstValueBN)
          .accountsPartial({
            stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
          })
          .rpc();
      }
    }

    currentTimestamp = Math.floor(Date.now() / 1000);
    await stakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("10"),
    );

//     let stakeAccountCheckpoints: CheckpointAccount =
//       await stakeConnection.fetchCheckpointAccount(
//         stakeAccountCheckpointsAddress,
//       );
//     console.log("stakeAccountCheckpoints:", stakeAccountCheckpoints.toString());

    await stakeConnection.program.methods
      .createCheckpoints()
      .accounts({
        stakeAccountCheckpoints: stakeAccountCheckpointsAddress,
        stakeAccountMetadata: stakeAccountMetadataAddress,
      })
      .rpc({ skipPreflight: true })
      .then(confirm);

    let newStakeAccountCheckpointsAddress =
      await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    await stakeConnection.program.methods
      .addCheckpointsBulk(new BN(3), firstTimestampBN, firstValueBN)
      .accountsPartial({
        stakeAccountCheckpoints: newStakeAccountCheckpointsAddress,
      })
      .rpc();

//     let newStakeAccountCheckpoints: CheckpointAccount =
//       await stakeConnection.fetchCheckpointAccount(
//         newStakeAccountCheckpointsAddress,
//       );
//     console.log("newStakeAccountCheckpoints:", newStakeAccountCheckpoints.toString());

    const voteStart = currentTimestamp + 3;
//     console.log("voteStart:", voteStart);
    let proposalIdInput = await addTestProposal(
      stakeConnection,
      voteStart,
    );

    const { proposalAccount } =
      await stakeConnection.fetchProposalAccount(proposalIdInput);
    await stakeConnection.program.methods
      .castVote(
        Array.from(proposalIdInput),
        new BN(10),
        new BN(50),
        new BN(20),
        0,
      )
      .accountsPartial({
        proposal: proposalAccount,
        voterCheckpoints: stakeAccountCheckpointsAddress,
        voterCheckpointsNext: newStakeAccountCheckpointsAddress,
      })
      .rpc();

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await stakeConnection.proposalVotes(proposalIdInput);

    assert.equal(proposalId.toString("hex"), proposalIdInput.toString("hex"));
    assert.equal(againstVotes.toString(), "10");
    assert.equal(forVotes.toString(), "50");
    assert.equal(abstainVotes.toString(), "20");
  });
});

async function addTestProposal(
  stakeConnection: StakeConnection,
  voteStart: number,
) {
  const proposalIdInput = crypto
    .createHash("sha256")
    .update("proposalId" + Date.now())
    .digest();

  const ethProposalResponseBytes = createProposalQueryResponseBytes(
    proposalIdInput,
    voteStart,
  );
  const signaturesKeypair = Keypair.generate();
  const mock = new QueryProxyMock({});
  const mockSignatures = mock.sign(ethProposalResponseBytes);
  await stakeConnection.postSignatures(mockSignatures, signaturesKeypair);
  const mockGuardianSetIndex = 5;

  await stakeConnection.addProposal(
    proposalIdInput,
    ethProposalResponseBytes,
    signaturesKeypair.publicKey,
    mockGuardianSetIndex,
  );

  return proposalIdInput;
}
