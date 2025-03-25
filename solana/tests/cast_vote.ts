import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
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
import BN from "bn.js";
import path from "path";
import { createProposalQueryResponseBytes } from "./utils/api_utils";
import { StakeConnection, WHTokenBalance } from "../app";
import { TEST_CHECKPOINTS_ACCOUNT_LIMIT } from "./utils/constants";
import { CheckpointAccount } from "../app/checkpoints";
import crypto from "crypto";
import { QueryProxyMock } from "@wormhole-foundation/wormhole-query-sdk";
import { AnchorError, utils } from "@coral-xyz/anchor";
import * as importedWasm from "@wormhole/staking-wasm";
let wasm = importedWasm;
export { wasm };

const portNumber = getPortNumber(path.basename(__filename));

describe("castVote", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const governanceAuthority = new Keypair();

  let stakeConnection: StakeConnection;
  let user2StakeConnection: StakeConnection;
  let user3StakeConnection: StakeConnection;
  let user4StakeConnection: StakeConnection;
  let user5StakeConnection: StakeConnection;
  let user6StakeConnection: StakeConnection;
  let user7StakeConnection: StakeConnection;
  let user8StakeConnection: StakeConnection;
  let user9StakeConnection: StakeConnection;

  let controller;
  let user2;
  let user3;
  let user4;
  let user5;
  let user6;
  let user7;
  let user8;
  let user9;

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
      makeTestConfig(whMintAccount.publicKey),
      WHTokenBalance.fromString("1000"),
    ));

    user2StakeConnection = await newUserStakeConnection(
      stakeConnection,
      Keypair.generate(),
      config,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );
    user2 = user2StakeConnection.provider.wallet.publicKey;

    user3StakeConnection = await newUserStakeConnection(
      stakeConnection,
      Keypair.generate(),
      config,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );
    user3 = user3StakeConnection.provider.wallet.publicKey;

    user4StakeConnection = await newUserStakeConnection(
      stakeConnection,
      Keypair.generate(),
      config,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );
    user4 = user4StakeConnection.provider.wallet.publicKey;

    user5StakeConnection = await newUserStakeConnection(
      stakeConnection,
      Keypair.generate(),
      config,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );
    user5 = user5StakeConnection.provider.wallet.publicKey;

    user6StakeConnection = await newUserStakeConnection(
      stakeConnection,
      Keypair.generate(),
      config,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );
    user6 = user6StakeConnection.provider.wallet.publicKey;

    user7StakeConnection = await newUserStakeConnection(
      stakeConnection,
      Keypair.generate(),
      config,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );
    user7 = user7StakeConnection.provider.wallet.publicKey;

    user8StakeConnection = await newUserStakeConnection(
      stakeConnection,
      Keypair.generate(),
      config,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );
    user8 = user8StakeConnection.provider.wallet.publicKey;

    user9StakeConnection = await newUserStakeConnection(
      stakeConnection,
      Keypair.generate(),
      config,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );
    user9 = user9StakeConnection.provider.wallet.publicKey;
  });

  it("should fail to castVote if proposal inactive", async () => {
    await user6StakeConnection.delegate(
      user6,
      WHTokenBalance.fromString("50"),
    );

    let proposalIdInput = await addTestProposal(
      user6StakeConnection,
      Math.floor(Date.now() / 1000) + 20,
    );

    let stakeAccountMetadataAddress =
      await user6StakeConnection.getStakeMetadataAddress(
        user6,
      );
    let previousStakeAccountCheckpointsAddress =
      await user6StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    const { proposalAccount } =
      await user6StakeConnection.fetchProposalAccount(proposalIdInput);

    try {
      await user6StakeConnection.program.methods
        .castVote(
          Array.from(proposalIdInput),
          new BN(10),
          new BN(20),
          new BN(12),
          0,
        )
        .accountsPartial({
          proposal: proposalAccount,
          voterCheckpoints: previousStakeAccountCheckpointsAddress,
          voterCheckpointsNext: null,
        })
        .rpc();

      assert.fail("Expected an error but none was thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "ProposalInactive",
      );
    }
  });

  it("should fail to castVote if votes were added in the voteWeightWindow", async () => {
    await user6StakeConnection.delegate(
      user6,
      WHTokenBalance.fromString("100"),
    );

    // voteWeightWindow is 10s
    let proposalIdInput = await addTestProposal(
      user6StakeConnection,
      Math.floor(Date.now() / 1000) + 3,
    );
    await sleep(4000);

    let stakeAccountMetadataAddress =
      await user6StakeConnection.getStakeMetadataAddress(
        user6,
      );
    let previousStakeAccountCheckpointsAddress =
      await user6StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );

    const { proposalAccount } =
      await user6StakeConnection.fetchProposalAccount(proposalIdInput);

    try {
      await user6StakeConnection.program.methods
        .castVote(
          Array.from(proposalIdInput),
          new BN(10),
          new BN(20),
          new BN(12),
          0,
        )
        .accountsPartial({
          proposal: proposalAccount,
          voterCheckpoints: previousStakeAccountCheckpointsAddress,
          voterCheckpointsNext: null,
        })
        .rpc();

      assert.fail("Expected an error but none was thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "CheckpointNotFound",
      );
    }
  });

  it("should successfully castVote", async () => {
    await user3StakeConnection.delegate(
      user3,
      WHTokenBalance.fromString("150"),
    );

    let voteStart = Math.floor(Date.now() / 1000) + 12;
    let proposalIdInput = await addTestProposal(
      user3StakeConnection,
      voteStart,
    );

    while (voteStart >= Math.floor(Date.now() / 1000)) {
      await sleep(1000);
    }
    await sleep(1000);
    await user3StakeConnection.castVote(
      proposalIdInput,
      new BN(10),
      new BN(20),
      new BN(12),
      0,
    );
    await user3StakeConnection.castVote(
      proposalIdInput,
      new BN(10),
      new BN(10),
      new BN(0),
      0,
    );
    await user3StakeConnection.castVote(
      proposalIdInput,
      new BN(0),
      new BN(7),
      new BN(10),
      0,
    );

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await user3StakeConnection.proposalVotes(proposalIdInput);

    assert.equal(proposalId.toString("hex"), proposalIdInput.toString("hex"));
    assert.equal(againstVotes.toString(), "20");
    assert.equal(forVotes.toString(), "37");
    assert.equal(abstainVotes.toString(), "22");
  });

  it("should cast vote with the correct weight", async () => {
    let proposalIdInput;
    let voteStart;

    // Create 6 checkpoints, 1 second apart
    for (let i = 0; i < 6; i++) {
      await user7StakeConnection.delegate(
        user7,
        WHTokenBalance.fromString("50"),
      );

      // Create a proposal with a start time 10 seconds in the future in iteration 5
      // We do this because the vote weight window is 10 seconds
      if (i == 4) {
        voteStart = Math.floor(Date.now() / 1000) + 10;
        proposalIdInput = await addTestProposal(
          user7StakeConnection,
          voteStart,
        );
      }

      await sleep(1000);
    }

    while (voteStart >= Math.floor(Date.now() / 1000)) {
      await sleep(1000);
    }
    await sleep(1000);
    await user7StakeConnection.castVote(
      proposalIdInput,
      new BN(10),
      new BN(20),
      new BN(12),
      0,
    );

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await user7StakeConnection.proposalVotes(proposalIdInput);

    assert.equal(proposalId.toString("hex"), proposalIdInput.toString("hex"));
    assert.equal(againstVotes.toString(), "10");
    assert.equal(forVotes.toString(), "20");
    assert.equal(abstainVotes.toString(), "12");
  });

  it("should fail to castVote if next voter checkpoints are invalid", async () => {
    await sleep(1000);
    await user4StakeConnection.delegate(
      user4,
      WHTokenBalance.fromString("5"),
    );

    let voteStart = Math.floor(Date.now() / 1000) + 25;
    let proposalIdInput = await addTestProposal(
      user4StakeConnection,
      voteStart,
    );

    const { proposalAccount } =
      await user4StakeConnection.fetchProposalAccount(proposalIdInput);

    // filling the checkpoint account to the limit
    for (let i = 1; i < TEST_CHECKPOINTS_ACCOUNT_LIMIT; i++) {
      await sleep(1000);
      await user4StakeConnection.delegate(
        user4,
        WHTokenBalance.fromString("5"),
      );
    }
    await sleep(5000);
    while (voteStart >= Math.floor(Date.now() / 1000)) {
      await sleep(1000);
    }

    let currentStakeAccountCheckpointsAddress =
      await user4StakeConnection.getStakeAccountCheckpointsAddress(
        user4,
        0,
      );
    let currentStakeAccountCheckpoints: CheckpointAccount =
      await user4StakeConnection.fetchCheckpointAccount(
        currentStakeAccountCheckpointsAddress,
      );
    // current checkpoint account is fully filled out
    assert.equal(
      currentStakeAccountCheckpoints.getCheckpointCount(),
      TEST_CHECKPOINTS_ACCOUNT_LIMIT,
    );
    assert(
      currentStakeAccountCheckpoints.getLastCheckpoint().timestamp <
        voteStart,
    );

    try {
      await user4StakeConnection.program.methods
        .castVote(
          Array.from(proposalIdInput),
          new BN(10),
          new BN(20),
          new BN(12),
          0,
        )
        .accountsPartial({
          proposal: proposalAccount,
          voterCheckpoints: currentStakeAccountCheckpointsAddress,
          voterCheckpointsNext: currentStakeAccountCheckpointsAddress,
        })
        .rpc();

      assert.fail("Expected an error but none was thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code ===
          "InvalidNextVoterCheckpoints",
      );
    }
  });

  it("should fail to castVote if the wanted checkpoint is the last one in the filled account", async () => {
    let currentStakeAccountCheckpointsAddress =
      await user4StakeConnection.getStakeAccountCheckpointsAddress(
        user4,
        0,
      );
    let currentStakeAccountCheckpoints: CheckpointAccount =
      await user4StakeConnection.fetchCheckpointAccount(
        currentStakeAccountCheckpointsAddress,
      );

    // current checkpoint account is fully filled out
    assert.equal(
      currentStakeAccountCheckpoints.getCheckpointCount(),
      TEST_CHECKPOINTS_ACCOUNT_LIMIT,
    );

    let proposalIdInput = await addTestProposal(
      user4StakeConnection,
      Math.floor(Date.now() / 1000) + 11,
    );
    await sleep(12000);

    const { proposalAccount } =
      await user4StakeConnection.fetchProposalAccount(proposalIdInput);

    try {
      await user4StakeConnection.program.methods
        .castVote(
          Array.from(proposalIdInput),
          new BN(10),
          new BN(20),
          new BN(12),
          0,
        )
        .accountsPartial({
          proposal: proposalAccount,
          voterCheckpoints: currentStakeAccountCheckpointsAddress,
          voterCheckpointsNext: null,
        })
        .rpc();

      assert.fail("Expected an error but none was thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "CheckpointOutOfBounds",
      );
    }
  });

  it("should successfully castVote with new checkpoint account created by any random user", async () => {
    // filling the checkpoint account to the limit
    for (let i = 0; i < TEST_CHECKPOINTS_ACCOUNT_LIMIT; i++) {
      await sleep(1000);
      await user5StakeConnection.delegate(
        user5,
        WHTokenBalance.fromString("5"),
      );
    }

    let user5StakeAccountMetadataAddress =
      await user5StakeConnection.getStakeMetadataAddress(
        user5,
      );
    let user5StakeAccountCheckpointsAddress =
      await user5StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        user5StakeAccountMetadataAddress,
        true,
      );

    const randomUser = new Keypair();
    let tx = new Transaction();
    tx.instructions = [
      SystemProgram.transfer({
        fromPubkey: stakeConnection.program.provider.publicKey,
        toPubkey: randomUser.publicKey,
        lamports: 10 * LAMPORTS_PER_SOL,
      }),
    ];
    await stakeConnection.program.provider.sendAndConfirm(tx, [
      stakeConnection.program.provider.wallet.payer,
    ]);

    await user5StakeConnection.program.methods
      .createCheckpoints()
      .accounts({
        payer: randomUser.publicKey,
        stakeAccountCheckpoints: user5StakeAccountCheckpointsAddress,
        stakeAccountMetadata: user5StakeAccountMetadataAddress,
      })
      .signers([randomUser])
      .rpc({ skipPreflight: true })
      .then(confirm);

    await user5StakeConnection.delegate(
      user5,
      WHTokenBalance.fromString("150"),
    );

    let proposalIdInput = await addTestProposal(
      user5StakeConnection,
      Math.floor(Date.now() / 1000),
    );

    await user5StakeConnection.castVote(
      proposalIdInput,
      new BN(10),
      new BN(20),
      new BN(12),
      0,
    );

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await user5StakeConnection.proposalVotes(proposalIdInput);

    assert.equal(proposalIdInput.toString("hex"), proposalId.toString("hex"));
    assert.equal(againstVotes.toString(), "10");
    assert.equal(forVotes.toString(), "20");
    assert.equal(abstainVotes.toString(), "12");
  });

  it("should correctly handle last checkpoint skip when voter_checkpoints is full", async () => {
    // filling the checkpoint account to the limit
    for (let i = 0; i < TEST_CHECKPOINTS_ACCOUNT_LIMIT - 1; i++) {
      await sleep(1000);
      await user8StakeConnection.delegate(
        user8,
        WHTokenBalance.fromString("5"),
      );
    }

    let user8StakeAccountMetadataAddress =
      await user8StakeConnection.getStakeMetadataAddress(
        user8,
      );
    let previousUser8StakeAccountCheckpointsAddress =
      await user8StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        user8StakeAccountMetadataAddress,
        false,
      );
    let user8StakeAccountCheckpointsAddress =
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
          user8.toBuffer(),
          Buffer.from([1, 0]),
        ],
        user8StakeConnection.program.programId,
      )[0];

    let user6StakeAccountMetadataAddress =
      await user6StakeConnection.getStakeMetadataAddress(
        user6,
      );
    let user6StakeAccountCheckpointsAddress =
      await user6StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        user6StakeAccountMetadataAddress,
        false,
      );

    await sleep(1000);
    const instructions: TransactionInstruction[] = [];
    instructions.push(
      await user8StakeConnection.buildTransferInstruction(
        user8,
        WHTokenBalance.fromString("5").toBN(),
      ),
    );
    instructions.push(
      await user8StakeConnection.program.methods
        .delegate(
          user6,
          user8,
        )
        .accountsPartial({
          currentDelegateStakeAccountCheckpoints:
            previousUser8StakeAccountCheckpointsAddress,
          delegateeStakeAccountCheckpoints:
            user6StakeAccountCheckpointsAddress,
          vestingConfig: null,
          vestingBalance: null,
          mint: user8StakeConnection.config.votingTokenMint,
        })
        .instruction(),
    );
    instructions.push(
      await user8StakeConnection.program.methods
        .createCheckpoints()
        .accounts({
          payer: user8,
          stakeAccountCheckpoints:
            previousUser8StakeAccountCheckpointsAddress,
          newStakeAccountCheckpoints: user8StakeAccountCheckpointsAddress,
          stakeAccountMetadata: user8StakeAccountMetadataAddress,
        })
        .instruction(),
    );
    instructions.push(
      await user8StakeConnection.program.methods
        .delegate(
          user8,
          user6,
        )
        .accountsPartial({
          currentDelegateStakeAccountCheckpoints:
            user6StakeAccountCheckpointsAddress,
          delegateeStakeAccountCheckpoints:
            user8StakeAccountCheckpointsAddress,
          vestingConfig: null,
          vestingBalance: null,
          mint: user8StakeConnection.config.votingTokenMint,
        })
        .instruction(),
    );
    await user8StakeConnection.sendAndConfirmAsVersionedTransaction(
      instructions,
    );

    await sleep(2000);
    await user8StakeConnection.delegate(
      user8,
      WHTokenBalance.fromString("150"),
    );

    let previousUser8StakeAccountCheckpoints: CheckpointAccount =
    await user8StakeConnection.fetchCheckpointAccount(
      previousUser8StakeAccountCheckpointsAddress,
    );
    assert.equal(
      previousUser8StakeAccountCheckpoints.checkpoints[TEST_CHECKPOINTS_ACCOUNT_LIMIT - 1].value.toString(),
      "0",
    );

    let user8StakeAccountCheckpoints: CheckpointAccount =
      await user8StakeConnection.fetchCheckpointAccount(
        user8StakeAccountCheckpointsAddress,
      );
    assert.equal(
      user8StakeAccountCheckpoints.checkpoints[0].value.toString(),
      "75000000",
    );
    assert.equal(
      user8StakeAccountCheckpoints.checkpoints[1].value.toString(),
      "225000000",
    );

    let proposalIdInput = await addTestProposal(
      user8StakeConnection,
      Math.floor(Date.now() / 1000),
    );
    await user8StakeConnection.castVote(
      proposalIdInput,
      new BN(10),
      new BN(20),
      new BN(12),
      0,
    );

    const { proposalId, againstVotes, forVotes, abstainVotes } =
    await user8StakeConnection.proposalVotes(proposalIdInput);

    assert.equal(proposalId.toString("hex"), proposalIdInput.toString("hex"));
    assert.equal(againstVotes.toString(), "10");
    assert.equal(forVotes.toString(), "20");
    assert.equal(abstainVotes.toString(), "12");
  });

  it("should fail to castVote with zeroing out the first checkpoint in new checkpoint account", async () => {
    // filling the checkpoint account to the limit
    for (let i = 0; i < TEST_CHECKPOINTS_ACCOUNT_LIMIT - 1; i++) {
      await sleep(1000);
      await user9StakeConnection.delegate(
        user9,
        WHTokenBalance.fromString("5"),
      );
    }

    let user9StakeAccountMetadataAddress =
      await user9StakeConnection.getStakeMetadataAddress(
        user9,
      );
    let previousUser9StakeAccountCheckpointsAddress =
      await user9StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        user9StakeAccountMetadataAddress,
        false,
      );
    let user9StakeAccountCheckpointsAddress =
      PublicKey.findProgramAddressSync(
        [
          utils.bytes.utf8.encode(wasm.Constants.CHECKPOINT_DATA_SEED()),
          user9.toBuffer(),
          Buffer.from([1, 0]),
        ],
        user9StakeConnection.program.programId,
      )[0];

    let user6StakeAccountMetadataAddress =
      await user6StakeConnection.getStakeMetadataAddress(
        user6,
      );
    let user6StakeAccountCheckpointsAddress =
      await user6StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        user6StakeAccountMetadataAddress,
        false,
      );

    await sleep(2000);
    const instructions: TransactionInstruction[] = [];
    instructions.push(
      await user9StakeConnection.buildTransferInstruction(
        user9,
        WHTokenBalance.fromString("5").toBN(),
      ),
    );
    instructions.push(
      await user9StakeConnection.program.methods
        .delegate(
          user9,
          user9,
        )
        .accountsPartial({
          currentDelegateStakeAccountCheckpoints:
            previousUser9StakeAccountCheckpointsAddress,
          delegateeStakeAccountCheckpoints:
            previousUser9StakeAccountCheckpointsAddress,
          vestingConfig: null,
          vestingBalance: null,
          mint: user9StakeConnection.config.votingTokenMint,
        })
        .instruction(),
    );
    instructions.push(
      await user9StakeConnection.program.methods
        .createCheckpoints()
        .accounts({
          payer: user9,
          stakeAccountCheckpoints:
            previousUser9StakeAccountCheckpointsAddress,
          newStakeAccountCheckpoints: user9StakeAccountCheckpointsAddress,
          stakeAccountMetadata: user9StakeAccountMetadataAddress,
        })
        .instruction(),
    );
    instructions.push(
      await user9StakeConnection.program.methods
        .delegate(
          user6,
          user9,
        )
        .accountsPartial({
          currentDelegateStakeAccountCheckpoints:
            user9StakeAccountCheckpointsAddress,
          delegateeStakeAccountCheckpoints:
            user6StakeAccountCheckpointsAddress,
          vestingConfig: null,
          vestingBalance: null,
          mint: user9StakeConnection.config.votingTokenMint,
        })
        .instruction(),
    );
    await user9StakeConnection.sendAndConfirmAsVersionedTransaction(
      instructions,
    );

    await sleep(2000);
    await user9StakeConnection.delegate(
      user9,
      WHTokenBalance.fromString("150"),
    );

    let user9StakeAccountCheckpoints: CheckpointAccount =
      await user9StakeConnection.fetchCheckpointAccount(
        user9StakeAccountCheckpointsAddress,
      );
    assert.equal(
      user9StakeAccountCheckpoints.checkpoints[0].value.toString(),
      "0",
    );
    assert.equal(
      user9StakeAccountCheckpoints.checkpoints[1].value.toString(),
      "225000000",
    );

    let proposalIdInput = await addTestProposal(
      user9StakeConnection,
      Math.floor(Date.now() / 1000),
    );
    const { proposalAccount } =
      await user9StakeConnection.fetchProposalAccount(proposalIdInput);

    await sleep(1000);
    try {
      await user9StakeConnection.program.methods
        .castVote(
          Array.from(proposalIdInput),
          new BN(10),
          new BN(20),
          new BN(12),
          0,
        )
        .accountsPartial({
          proposal: proposalAccount,
          voterCheckpoints: previousUser9StakeAccountCheckpointsAddress,
          voterCheckpointsNext: user9StakeAccountCheckpointsAddress,
        })
        .rpc();

      assert.fail("Expected an error but none was thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "NoWeight");
    }
  });

  it("should fail when castVote with an invalid voter checkpoints", async () => {
    let proposalId = await addTestProposal(
      user2StakeConnection,
      Math.floor(Date.now() / 1000) + 12,
    );

    await user2StakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("200"),
    );

    const { proposalAccount } =
      await user2StakeConnection.fetchProposalAccount(proposalId);

    try {
      await user2StakeConnection.program.methods
        .castVote(
          Array.from(proposalId),
          new BN(10),
          new BN(20),
          new BN(12),
          1,
        )
        .accountsPartial({
          proposal: proposalAccount,
          voterCheckpoints:
            await stakeConnection.getStakeAccountCheckpointsAddress(
              user4,
              0,
            ),
          voterCheckpointsNext: null,
        })
        .rpc();

      assert.fail("Expected an error but none was thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "ConstraintSeeds");
    }
  });

  it("should successfully castVote when voter_checkpoints is almost full (one checkpoint less than limit)", async () => {
    let voteStart;
    let proposalIdInput;

    let stakeAccountMetadataAddress =
      await user2StakeConnection.getStakeMetadataAddress(
        user2,
      );
    let currentStakeAccountCheckpointsAddress =
      await user2StakeConnection.getStakeAccountCheckpointsAddressByMetadata(
        stakeAccountMetadataAddress,
        false,
      );
    let currentStakeAccountCheckpoints: CheckpointAccount =
      await user2StakeConnection.fetchCheckpointAccount(
        currentStakeAccountCheckpointsAddress,
      );
    let checkpointCount = currentStakeAccountCheckpoints.getCheckpointCount();

    assert.equal(
      checkpointCount,
      1,
    );

    // fill checkpoint account to one less than the limit
    for (let i = 0; i < TEST_CHECKPOINTS_ACCOUNT_LIMIT - checkpointCount - 1; i++) {
      await sleep(1000);
      await user2StakeConnection.delegate(
        user2,
        WHTokenBalance.fromString("5")
      );

      if (i == 9) {
        voteStart = Math.floor(Date.now() / 1000) + 10;
        proposalIdInput = await addTestProposal(
          user2StakeConnection,
          voteStart,
        );
      }
    }

    let updatedCurrentStakeAccountCheckpoints: CheckpointAccount =
    await user2StakeConnection.fetchCheckpointAccount(
      currentStakeAccountCheckpointsAddress,
    );
    assert.equal(
      updatedCurrentStakeAccountCheckpoints.getCheckpointCount(),
      TEST_CHECKPOINTS_ACCOUNT_LIMIT - 1,
    );

    while (voteStart >= Math.floor(Date.now() / 1000)) {
      await sleep(1000);
    }
    await sleep(1000);
    await user2StakeConnection.castVote(
      proposalIdInput,
      new BN(10),
      new BN(20),
      new BN(12),
      0,
    );

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await user2StakeConnection.proposalVotes(proposalIdInput);

    assert.equal(proposalId.toString("hex"), proposalIdInput.toString("hex"));
    assert.equal(againstVotes.toString(), "10");
    assert.equal(forVotes.toString(), "20");
    assert.equal(abstainVotes.toString(), "12");
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
  const mock = new QueryProxyMock({});
  const mockSignatures = mock.sign(ethProposalResponseBytes);
  const guardianSignaturesPda =
    await stakeConnection.postSignatures(mockSignatures);
  const mockGuardianSetIndex = 5;

  await stakeConnection.addProposal(
    proposalIdInput,
    ethProposalResponseBytes,
    guardianSignaturesPda,
    mockGuardianSetIndex,
  );

  return proposalIdInput;
}
