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

describe("cast_vote with more than max checkpoints count", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const governanceAuthority = new Keypair();

  const LARGE_CHECKPOINTS_ACCOUNT_LIMIT = 1000;
  const VOTE_WEIGHT_WINDOW_LENGTH = MAX_VOTE_WEIGHT_WINDOW_LENGTH + 60;

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

  it("should fail to castVote if the vote weight windows more than MAX_VOTE_WEIGHT_WINDOW_LENGTH", async () => {
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

    const totalCheckpointsCount = VOTE_WEIGHT_WINDOW_LENGTH;
    const checkpointsCountPerInstruction = 31;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    let checkpointsCountBN = new BN(checkpointsCountPerInstruction);
    const firstTimestampBN = new BN(currentTimestamp - totalCheckpointsCount);
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

//     let stakeAccountCheckpoints: CheckpointAccount =
//       await stakeConnection.fetchCheckpointAccount(
//         stakeAccountCheckpointsAddress,
//       );
//     console.log("stakeAccountCheckpoints:", stakeAccountCheckpoints.toString());
    const voteStart = currentTimestamp;
//     console.log("voteStart:", voteStart);
    let proposalIdInput = await addTestProposal(
      stakeConnection,
      voteStart,
    );

    const { proposalAccount } =
      await stakeConnection.fetchProposalAccount(proposalIdInput);

    try {
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
          voterCheckpointsNext: null,
        })
        .rpc();

      assert.fail("Expected an error but none was thrown");
    } catch (e) {
//       console.log("e:",e)
      assert(e.logs.find((log) =>
        log.includes(`exceeded CUs meter at BPF instruction`) ||
        log.includes(`Computational budget exceeded`)
      ));
    }
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
