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
import { getAssociatedTokenAddress } from "@solana/spl-token";
import BN from "bn.js";
import path from "path";
import {
  createNonFinalizedProposalQueryResponseBytes,
  createProposalQueryResponseBytes,
  createProposalQueryResponseBytesWithInvalidChainSpecificQuery,
  createProposalQueryResponseBytesWithInvalidChainSpecificResponse,
  createProposalQueryResponseBytesWithInvalidFunctionSignature,
} from "./utils/api_utils";
import {
  StakeConnection,
  WHTokenBalance,
  TEST_CHECKPOINTS_ACCOUNT_LIMIT,
} from "../app";
import { CheckpointAccount } from "../app/checkpoints";
import crypto from "crypto";
import {
  QueryProxyMock,
  signaturesToSolanaArray,
} from "@wormhole-foundation/wormhole-query-sdk";
import { AnchorError, utils } from "@coral-xyz/anchor";
import * as importedWasm from "@wormhole/staking-wasm";
let wasm = importedWasm;
export { wasm };

const portNumber = getPortNumber(path.basename(__filename));

describe("api", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const governanceAuthority = new Keypair();

  const ethProposalResponse = {
    bytes:
      "01000051ced87ef0a0bb371964f793bb665a01435d57c9dc79b9fb6f31323f99f557ee0fa583718753cb3b35fe7c2e9bab2afde3f8cfdbeee0432804cb3c9146027a9401000000370100000001010002010000002a0000000930783132346330643601c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000406fdde030100020100000095000000000124c0d60f319af73bad19735c2f795e3bf22c0cb3d6be77b5fbd3bc1cf197efdbfb506c000610e4cf31cfc001000000600000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000d5772617070656420457468657200000000000000000000000000000000000000",
    signatures: [
      "f122af3db0ae62af57bc16f0b3e79c86cbfc860a5994ca65928c06a739a2f4ca0496c7c1de38350e7b7cdc573fa0b7af981f3ac3d60298d67c76ca99d3bcf1040002",
      "7b9af5d9a3438b5d44e04b7ae8c64894b8ea6a94701bf048bd106a3c79a6d2896843dae20b8db3fea62520565ddaf95a24d77783dfd990f7dc60a1a5c39d16840103",
      "1a86399f16aee73e4aac7d9b06359805a818dd753cd3be77d7934a086f32b6d15d9166fa2d30af365c92bd6a8500c94a377d30a4b64741326f220ea920f4ecc20104",
      "d4e9a063e8c015bf33081f2e37b3379870d5de6798d40694a69e92dcf66264540c84b26737617b93742b74d55068295c68ab7630efa8dc4f6d40b9c30ff17fb40006",
      "998f80bd8c4f30ad30850782e9aaa24212470e233d48a126f3b174e241d8668872d0c37d306aecd15a6e740306bb625e31692ab1c58e89fe6030fa00b1e34c4d0107",
      "59a772f2626f7376ff8a5279cea20290b625febd9b0dc8c312fcf59a3427445b4a97acbfe9394eacd709a6c49763bcb9d6bf7464f32020338a0f2edc824864f00109",
      "4160ea981f0c5c1e9677aea518e5e999216dc6320b92037aea92266975468e9b2be7e73594f8e5b58290f57d7d0875654da779f38e1b167d06f71fead234d4a3010a",
      "634f00406ff3d8ef65c5cb12bdb7cccdbc8da65025775e3a1f230ec167033de719dcdddb103c98be132478d559c4d8ee0b73f74bd89b06d525d4f6f09e8048c6000c",
      "e7580e30907d0077951b62febd93daf3e9ae1887fe7b23c7a06354bb9aefb73c5613cbffb64e9887de71a90ab534533613f4b728a902a0be908e33b2bc070909010d",
      "23fe620935057eab2e45cfeea8965985c0f3c96122ed1d12df3f39d1484eaeb940ad4dc225825fb68231384a094d420930f5060061b6dec71df4f1c752184a4a010e",
      "ed986adf2099a6dc08bed9b6260d72bccf3e2226d774464b4761e7f885ff765d0d5291f1429b14862a52b6991a95fa6b842b66c2c3459970db2f314a1acd27710110",
      "51b5c3b2f16104357ebce559f145ec0f6c1fcbec205dfcaefc1f131191e17fca0eb4eb76b6ff6550d1091644e00314ecd8aa94701e2ef8f00e5b62482710ef3c0011",
      "a3d0cba06bf40ed5a3cc858dde5d3ab5ad016b242c273532c5b1419efe5863ae35d315a7087d6f0592c4dc3a7fccb4b6f1893af558a282728f5d9f468921ffd70012",
    ],
  };

  const sepoliaEthProposalResponse = {
    bytes:
      "01000099920f75f0a3cb47a3284aa10c527942f9584b6b45ddfee7b0c428074f5a09be423519751ed54e034b8f7f88082ee3209cb2ebbcc36748a3662c1c9aaea40ba4010000005601000000000127120100000049000000083078363866643932012574802db8590ee5c9efc5ebebfef1e174b712fc00000024eb9b9838462c69856d29579a9fd5d80ced46f98862f1c83b47c04b928676f7e6919ad1f20127120100000075000000000068fd92661f69fa2dd05b39802af57c3a59e4292d75a41652ada0747a310233e474d7a2000624846c1719000100000040462c69856d29579a9fd5d80ced46f98862f1c83b47c04b928676f7e6919ad1f200000000000000000000000000000000000000000000000000000000670cd112",
    signatures: [
      "bd1f4486d0aa0bf2a850272fc1822937e1a833f991de2e441fa96a4e3f098bcf0bdca11b1d126d432c658e0fcb712db5a7373451c8ad7a5f02db287f93a2ab3d0100",
    ],
  };

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
  let owner;
  let user2;
  let user3;
  let user4;
  let user6;
  let user7;
  let user8;
  let user9;
  let delegate;

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
    owner = stakeConnection.provider.wallet.publicKey;

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

  it("postSignatures", async () => {
    const guardianSignaturesPda = await await stakeConnection.postSignatures(
      ethProposalResponse.signatures,
    );
    const { guardianSignaturesData } =
      await stakeConnection.fetchGuardianSignaturesData(guardianSignaturesPda);
    const expectedSignatures = signaturesToSolanaArray(
      ethProposalResponse.signatures,
    );
    assert.equal(
      Buffer.from(guardianSignaturesData.guardianSignatures[1]).toString("hex"),
      Buffer.from(expectedSignatures[1]).toString("hex"),
    );
  });

  describe("addProposal", () => {
    it("should correctly add a proposal", async () => {
      const proposalIdInput = crypto
        .createHash("sha256")
        .update("proposalId11")
        .digest();
      const voteStart = Math.floor(Date.now() / 1000);

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

      const { proposalAccountData } =
        await stakeConnection.fetchProposalAccountData(proposalIdInput);
      assert.equal(
        Buffer.from(proposalAccountData.id).toString("hex"),
        proposalIdInput.toString("hex"),
      );
      assert.equal(
        proposalAccountData.voteStart.toString(),
        voteStart.toString(),
      );
      assert.equal(proposalAccountData.againstVotes.toString(), "0");
      assert.equal(proposalAccountData.forVotes.toString(), "0");
      assert.equal(proposalAccountData.abstainVotes.toString(), "0");
    });

    it.skip("should correctly add a real sepolia proposal", async () => {
      const proposalIdArray = Buffer.from(
        "462c69856d29579a9fd5d80ced46f98862f1c83b47c04b928676f7e6919ad1f2",
        "hex",
      );
      const voteStart = Buffer.from(
        "00000000000000000000000000000000000000000000000000000000670cd112",
        "hex",
      );

      const guardianSignaturesPda = await stakeConnection.postSignatures(
        sepoliaEthProposalResponse.signatures,
      );

      await stakeConnection.addProposal(
        proposalIdArray,
        Buffer.from(sepoliaEthProposalResponse.bytes, "hex"),
        guardianSignaturesPda,
        0,
      );

      const { proposalAccountData } =
        await stakeConnection.fetchProposalAccountData(proposalIdArray);
      assert.equal(
        Buffer.from(proposalAccountData.id).toString("hex"),
        proposalIdArray.toString("hex"),
      );
      assert.equal(
        proposalAccountData.voteStart.toString(),
        voteStart.toString(),
      );
      assert.equal(proposalAccountData.againstVotes.toString(), "0");
      assert.equal(proposalAccountData.forVotes.toString(), "0");
      assert.equal(proposalAccountData.abstainVotes.toString(), "0");
    });

    it("should revert if query block is not finalized", async () => {
      const proposalIdInput = crypto
        .createHash("sha256")
        .update("proposalId12")
        .digest();
      const voteStart = Math.floor(Date.now() / 1000);

      // Create a correct query, but with an incorrect finality (not “finalized”)
      const nonFinalizedEthProposalResponseBytes =
        createNonFinalizedProposalQueryResponseBytes(
          proposalIdInput,
          voteStart,
        );

      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(nonFinalizedEthProposalResponseBytes);
      const guardianSignaturesPda =
        await stakeConnection.postSignatures(mockSignatures);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          nonFinalizedEthProposalResponseBytes,
          guardianSignaturesPda,
          mockGuardianSetIndex,
          true,
        );
        assert.fail("Expected error was not thrown");
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code === "NonFinalizedBlock",
        );
      }
    });

    it("should revert if chain-specific query is invalid", async () => {
      const proposalIdInput = crypto
        .createHash("sha256")
        .update("proposalId13")
        .digest();
      const voteStart = Math.floor(Date.now() / 1000);

      // Create an invalid chain-specific query that does not match EthCallWithFinalityQueryRequest
      const invalidQueryEthProposalResponseBytes =
        createProposalQueryResponseBytesWithInvalidChainSpecificQuery(
          proposalIdInput,
          voteStart,
        );

      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(invalidQueryEthProposalResponseBytes);
      const guardianSignaturesPda =
        await stakeConnection.postSignatures(mockSignatures);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          invalidQueryEthProposalResponseBytes,
          guardianSignaturesPda,
          mockGuardianSetIndex,
          true,
        );
        assert.fail("Expected error was not thrown");
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code ===
            "InvalidChainSpecificQuery",
        );
      }
    });

    it("should revert if chain-specific response is invalid", async () => {
      const proposalIdInput = crypto
        .createHash("sha256")
        .update("proposalId1")
        .digest();
      const voteStart = Math.floor(Date.now() / 1000);

      // Create an invalid response that does not match EthCallWithFinalityQueryResponse
      const invalidResponseEthProposalResponseBytes =
        createProposalQueryResponseBytesWithInvalidChainSpecificResponse(
          proposalIdInput,
          voteStart,
        );

      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(invalidResponseEthProposalResponseBytes);
      const guardianSignaturesPda =
        await stakeConnection.postSignatures(mockSignatures);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          invalidResponseEthProposalResponseBytes,
          guardianSignaturesPda,
          mockGuardianSetIndex,
          true,
        );
        assert.fail("Expected error was not thrown");
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code ===
            "InvalidChainSpecificResponse",
        );
      }
    });

    it("should revert if function signature is invalid", async () => {
      const proposalIdInput = crypto
        .createHash("sha256")
        .update("proposalId14")
        .digest();
      const voteStart = Math.floor(Date.now() / 1000);

      // Create a query with an invalid function signature
      const invalidFunctionSignatureEthProposalResponseBytes =
        createProposalQueryResponseBytesWithInvalidFunctionSignature(
          proposalIdInput,
          voteStart,
        );

      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(
        invalidFunctionSignatureEthProposalResponseBytes,
      );
      const guardianSignaturesPda =
        await stakeConnection.postSignatures(mockSignatures);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          invalidFunctionSignatureEthProposalResponseBytes,
          guardianSignaturesPda,
          mockGuardianSetIndex,
          true,
        );
        assert.fail("Expected error was not thrown");
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code ===
            "InvalidFunctionSignature",
        );
      }
    });

    it("should revert if voteStart is zero", async () => {
      const proposalIdInput = crypto
        .createHash("sha256")
        .update("proposalId15")
        .digest();
      const voteStart = 0;

      const ethProposalResponseBytes = createProposalQueryResponseBytes(
        proposalIdInput,
        voteStart,
      );
      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(ethProposalResponseBytes);
      const guardianSignaturesPda =
        await stakeConnection.postSignatures(mockSignatures);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          ethProposalResponseBytes,
          guardianSignaturesPda,
          mockGuardianSetIndex,
          true,
        );

        assert.fail("Expected error was not thrown");
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code ===
            "ProposalNotInitialized",
        );
      }
    });

    it("should revert if the vote start value is more than 8 bytes", async () => {
      const proposalIdInput = crypto
        .createHash("sha256")
        .update("proposalId16")
        .digest();
      const voteStart = Number("18446744073709551616"); // this is 2^64, which exceeds the maximum value of u64

      const ethProposalResponseBytes = createProposalQueryResponseBytes(
        proposalIdInput,
        voteStart,
      );
      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(ethProposalResponseBytes);
      const guardianSignaturesPda =
        await stakeConnection.postSignatures(mockSignatures);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          ethProposalResponseBytes,
          guardianSignaturesPda,
          mockGuardianSetIndex,
          true,
        );

        assert.fail("Expected error was not thrown");
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code ===
            "ErrorOfVoteStartParsing",
        );
      }
    });
  });

  it("proposalVotes", async () => {
    const proposalIdInput = crypto
      .createHash("sha256")
      .update("proposalId2")
      .digest();
    const voteStart = Math.floor(Date.now() / 1000);

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

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await stakeConnection.proposalVotes(proposalIdInput);

    assert.equal(proposalId.toString("hex"), proposalIdInput.toString("hex"));
    assert.equal(againstVotes.toString(), "0");
    assert.equal(forVotes.toString(), "0");
    assert.equal(abstainVotes.toString(), "0");
  });

  describe("delegate", () => {
    it("should successfully delegate votes", async () => {
      let stakeAccountMetadataAddress =
        await stakeConnection.getStakeMetadataAddress(owner);
      assert.equal(stakeAccountMetadataAddress, undefined);
      await sleep(2000);
      await stakeConnection.delegate(owner, WHTokenBalance.fromString("100"));
      stakeAccountMetadataAddress =
        await stakeConnection.getStakeMetadataAddress(owner);
      let stakeAccountCheckpointsAddress =
        await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
          stakeAccountMetadataAddress,
          false,
        );
      let stakeAccount = await stakeConnection.loadStakeAccount(
        stakeAccountCheckpointsAddress,
      );
      assert.equal(
        stakeAccount.tokenBalance.toString(),
        "100000000", // 100 * 10**6
      );

      await sleep(2000);
      await stakeConnection.delegate(owner, WHTokenBalance.fromString("100"));

      stakeAccount = await stakeConnection.loadStakeAccount(
        stakeAccountCheckpointsAddress,
      );
      assert.equal(
        stakeAccount.tokenBalance.toString(),
        "200000000", // 200 * 10**6
      );

      await sleep(2000);
      await stakeConnection.delegate(owner, WHTokenBalance.fromString("100"));

      stakeAccount = await stakeConnection.loadStakeAccount(
        stakeAccountCheckpointsAddress,
      );
      assert.equal(
        stakeAccount.tokenBalance.toString(),
        "300000000", // 300 * 10**6
      );
    });

    it("should change delegate account correctly", async () => {
      let stakeAccountMetadataAddress =
        await stakeConnection.getStakeMetadataAddress(owner);
      let stakeAccountCheckpointsAddress =
        await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
          stakeAccountMetadataAddress,
          false,
        );
      let stakeAccount = await stakeConnection.loadStakeAccount(
        stakeAccountCheckpointsAddress,
      );
      assert.equal(
        stakeAccount.tokenBalance.toString(),
        "300000000", // 300 * 10**6
      );

      await sleep(2000);
      stakeAccountCheckpointsAddress = await stakeConnection.delegate(
        undefined,
        WHTokenBalance.fromString("10"),
      );
      await sleep(2000);
      let user2stakeAccountCheckpointsAddress =
        await user2StakeConnection.delegate(
          undefined,
          WHTokenBalance.fromString("10"),
        );
      await sleep(2000);
      await stakeConnection.delegate(user2, WHTokenBalance.fromString("10"));
      delegate = await stakeConnection.delegates(owner);

      assert.equal(delegate.toBase58(), user2.toBase58());
    });

    it("should fail when delegating with an invalid current_delegate_stake_account_owner parameter", async () => {
      await sleep(2000);
      await user2StakeConnection.delegate(
        user2,
        WHTokenBalance.fromString("10"),
      );

      await sleep(2000);
      await stakeConnection.delegate(user2, WHTokenBalance.fromString("10"));
      let currentDelegate = await stakeConnection.delegates(owner);
      assert.equal(currentDelegate.toBase58(), user2.toBase58());
      let currentDelegateStakeAccountCheckpointsAddress =
        await stakeConnection.getStakeAccountCheckpointsAddress(
          currentDelegate,
          0,
        );

      await sleep(2000);
      const user3StakeAccountCheckpointsAddress =
        await user3StakeConnection.delegate(
          user3,
          WHTokenBalance.fromString("10"),
        );

      try {
        await stakeConnection.program.methods
          .delegate(
            user3, // delegatee: Pubkey
            user3, // Invalid current_delegate_stake_account_owner: Pubkey
          )
          .accounts({
            currentDelegateStakeAccountCheckpoints:
              currentDelegateStakeAccountCheckpointsAddress,
            delegateeStakeAccountCheckpoints:
              user3StakeAccountCheckpointsAddress,
            vestingConfig: null,
            vestingBalance: null,
            mint: stakeConnection.config.votingTokenMint,
          })
          .rpc();

        assert.fail("Expected an error but none was thrown");
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code ===
            "InvalidCurrentDelegate",
        );
      }
    });

    it("should fail when delegating with an invalid currentDelegateStakeAccountCheckpoints account", async () => {
      await sleep(2000);
      await user2StakeConnection.delegate(
        user2,
        WHTokenBalance.fromString("10"),
      );

      await sleep(2000);
      await stakeConnection.delegate(user2, WHTokenBalance.fromString("10"));
      let currentDelegate = await stakeConnection.delegates(owner);
      assert.equal(currentDelegate.toBase58(), user2.toBase58());

      await sleep(2000);
      const user3StakeAccountCheckpointsAddress =
        await user3StakeConnection.delegate(
          user3,
          WHTokenBalance.fromString("700"),
        );

      try {
        await stakeConnection.program.methods
          .delegate(
            user3, // delegatee: Pubkey
            currentDelegate, // current_delegate_stake_account_owner: Pubkey
          )
          .accounts({
            currentDelegateStakeAccountCheckpoints:
              user3StakeAccountCheckpointsAddress, // Invalid current delegate checkpoints account
            delegateeStakeAccountCheckpoints:
              user3StakeAccountCheckpointsAddress,
            vestingConfig: null,
            vestingBalance: null,
            mint: stakeConnection.config.votingTokenMint,
          })
          .rpc();

        assert.fail("Expected an error but none was thrown");
      } catch (e) {
        assert((e as AnchorError).error?.errorCode?.code === "ConstraintSeeds");
      }
    });

    it("should fail when delegating with an invalid delegateeStakeAccountCheckpoints account", async () => {
      await sleep(2000);

      await user2StakeConnection.delegate(
        user2,
        WHTokenBalance.fromString("10"),
      );

      await sleep(2000);
      const ownerStakeAccountCheckpointsAddress =
        await stakeConnection.delegate(user2, WHTokenBalance.fromString("10"));

      let currentDelegate = await stakeConnection.delegates(owner);
      assert.equal(currentDelegate.toBase58(), user2.toBase58());
      let currentDelegateStakeAccountCheckpointsAddress =
        await stakeConnection.getStakeAccountCheckpointsAddress(
          currentDelegate,
          0,
        );

      await sleep(2000);
      await user3StakeConnection.delegate(
        user3,
        WHTokenBalance.fromString("10"),
      );

      try {
        await stakeConnection.program.methods
          .delegate(
            user3, // delegatee: Pubkey
            currentDelegate, // current_delegate_stake_account_owner: Pubkey
          )
          .accounts({
            currentDelegateStakeAccountCheckpoints:
              currentDelegateStakeAccountCheckpointsAddress,
            delegateeStakeAccountCheckpoints:
              ownerStakeAccountCheckpointsAddress, // Invalid delegatee checkpoints account
            vestingConfig: null,
            vestingBalance: null,
            mint: stakeConnection.config.votingTokenMint,
          })
          .rpc();

        assert.fail("Expected an error but none was thrown");
      } catch (e) {
        assert((e as AnchorError).error?.errorCode?.code === "ConstraintSeeds");
      }
    });
  });

  describe("withdrawTokens", () => {
    it("should successfully withdrawTokens", async () => {
      let stakeAccountMetadataAddress =
        await stakeConnection.getStakeMetadataAddress(owner);
      let stakeAccountCheckpointsAddress =
        await stakeConnection.getStakeAccountCheckpointsAddressByMetadata(
          stakeAccountMetadataAddress,
          false,
        );
      let stakeAccount = await stakeConnection.loadStakeAccount(
        stakeAccountCheckpointsAddress,
      );
      assert.equal(
        stakeAccount.tokenBalance.toString(),
        "350000000", // 350 * 10**6
      );

      await sleep(2000);
      await stakeConnection.delegate(
        undefined,
        WHTokenBalance.fromString("100"),
      );

      stakeAccount = await stakeConnection.loadStakeAccount(
        stakeAccountCheckpointsAddress,
      );
      assert.equal(
        stakeAccount.tokenBalance.toString(),
        "450000000", // 450 * 10**6
      );

      await sleep(2000);
      await stakeConnection.withdrawTokens(
        stakeAccount,
        WHTokenBalance.fromString("50"),
      );

      stakeAccount = await stakeConnection.loadStakeAccount(
        stakeAccountCheckpointsAddress,
      );
      assert.equal(
        stakeAccount.tokenBalance.toString(),
        "400000000", // 400 * 10**6
      );
    });

    it("should fail when trying to withdraw zero tokens", async () => {
      let currentDelegate = await stakeConnection.delegates(owner);
      assert.equal(currentDelegate.toBase58(), user2.toBase58());

      let currentDelegateStakeAccountCheckpointsAddress =
        await stakeConnection.getStakeAccountCheckpointsAddress(
          currentDelegate,
          0,
        );

      const toAccount = await getAssociatedTokenAddress(
        stakeConnection.config.votingTokenMint,
        owner,
        true,
      );

      await sleep(2000);

      try {
        await stakeConnection.program.methods
          .withdrawTokens(
            WHTokenBalance.fromString("0").toBN(), // amount: u64
            currentDelegate, // current_delegate_stake_account_metadata_owner: Pubkey
            owner, // stake_account_metadata_owner: Pubkey
          )
          .accounts({
            currentDelegateStakeAccountCheckpoints:
            currentDelegateStakeAccountCheckpointsAddress,
            destination: toAccount,
          })
          .rpc();

        assert.fail("Expected an error but none was thrown");
      } catch (e) {
        assert((e as AnchorError).error?.errorCode?.code === "ZeroWithdrawal");
      }
    });

    it("should fail when withdrawal with an invalid current_delegate_stake_account_metadata_owner parameter", async () => {
      await sleep(2000);
      await user2StakeConnection.delegate(
        undefined,
        WHTokenBalance.fromString("10"),
      );

      await sleep(2000);
      await stakeConnection.delegate(user2, WHTokenBalance.fromString("10"));
      let currentDelegate = await stakeConnection.delegates(owner);
      assert.equal(currentDelegate.toBase58(), user2.toBase58());
      let currentDelegateStakeAccountCheckpointsAddress =
        await stakeConnection.getStakeAccountCheckpointsAddress(
          currentDelegate,
          0,
        );

      const toAccount = await getAssociatedTokenAddress(
        stakeConnection.config.votingTokenMint,
        owner,
        true,
      );

      try {
        await stakeConnection.program.methods
          .withdrawTokens(
            WHTokenBalance.fromString("5").toBN(), // amount: u64
            owner, // Invalid current_delegate_stake_account_metadata_owner: Pubkey
            owner, // stake_account_metadata_owner: Pubkey
          )
          .accounts({
            currentDelegateStakeAccountCheckpoints:
              currentDelegateStakeAccountCheckpointsAddress,
            destination: toAccount,
          })
          .rpc();

        assert.fail("Expected an error but none was thrown");
      } catch (e) {
        assert(
          (e as AnchorError).error?.errorCode?.code ===
            "InvalidCurrentDelegate",
        );
      }
    });

    it("should fail when withdrawal with an invalid currentDelegateStakeAccountCheckpoints account", async () => {
      await sleep(2000);
      await user2StakeConnection.delegate(
        undefined,
        WHTokenBalance.fromString("10"),
      );

      await sleep(2000);
      await stakeConnection.delegate(user2, WHTokenBalance.fromString("10"));
      let currentDelegate = await stakeConnection.delegates(owner);
      assert.equal(currentDelegate.toBase58(), user2.toBase58());

      const toAccount = await getAssociatedTokenAddress(
        stakeConnection.config.votingTokenMint,
        owner,
        true,
      );

      await sleep(2000);
      const user3StakeAccountCheckpointsAddress =
        await user3StakeConnection.delegate(
          user3,
          WHTokenBalance.fromString("50"),
        );

      try {
        await stakeConnection.program.methods
          .withdrawTokens(
            WHTokenBalance.fromString("5").toBN(), // amount: u64
            currentDelegate, // current_delegate_stake_account_metadata_owner: Pubkey
            owner, // stake_account_metadata_owner: Pubkey
          )
          .accounts({
            currentDelegateStakeAccountCheckpoints:
              user3StakeAccountCheckpointsAddress, // Invalid current delegate checkpoints account
            destination: toAccount,
          })
          .rpc();

        assert.fail("Expected an error but none was thrown");
      } catch (e) {
        assert((e as AnchorError).error?.errorCode?.code === "ConstraintSeeds");
      }
    });

    it("should withdraw tokens when a user self delegates and properly update the last checkpoint index", async () => {
      await sleep(1000);
      await user8StakeConnection.delegate(
        user8StakeConnection.userPublicKey(),
        WHTokenBalance.fromString("5"),
      );

      let currentStakeAccountCheckpointsAddress =
        await user8StakeConnection.getStakeAccountCheckpointsAddress(
          user8StakeConnection.userPublicKey(),
          0,
        );

      let currentStakeAccountCheckpoints: CheckpointAccount =
        await user8StakeConnection.fetchCheckpointAccount(
          currentStakeAccountCheckpointsAddress,
        );

      let currentCheckpointCount = currentStakeAccountCheckpoints.getCheckpointCount();

      // Fill all bar 1 checkpoints in the limit. Leave 1 space for the withdraw checkpoint
      for (currentCheckpointCount; currentCheckpointCount < TEST_CHECKPOINTS_ACCOUNT_LIMIT - 1; currentCheckpointCount++) {
        await sleep(1000);
        await user8StakeConnection.delegate(
          user8StakeConnection.userPublicKey(),
          WHTokenBalance.fromString("5"),
        );
      }

      let stakeAccount = await user8StakeConnection.loadStakeAccount(
        currentStakeAccountCheckpointsAddress,
      );

      let stakeAccountMetadata = await user8StakeConnection.fetchStakeAccountMetadata(user8StakeConnection.userPublicKey());

      let previousCheckpointAccountIndex = stakeAccountMetadata.stakeAccountCheckpointsLastIndex;
      let balanceBefore = stakeAccount.tokenBalance;

      // This withdraw action fills up the checkpoint account, which should increment the checkpoint account index
      await sleep(1000);
      await user8StakeConnection.withdrawTokens(
        stakeAccount,
        WHTokenBalance.fromString("5"),
      );

      stakeAccount = await user8StakeConnection.loadStakeAccount(
        currentStakeAccountCheckpointsAddress,
      );

      stakeAccountMetadata = await user8StakeConnection.fetchStakeAccountMetadata(user8StakeConnection.userPublicKey());


      let newCheckpointAccountIndex = stakeAccountMetadata.stakeAccountCheckpointsLastIndex;
      let balanceAfter = stakeAccount.tokenBalance;

      // Both the checkpoint index and the balance should be properly update
      assert.equal(previousCheckpointAccountIndex + 1, newCheckpointAccountIndex);
      assert.equal(
        balanceBefore - balanceAfter,
        5000000,
      );

    });
  });

  describe("castVote", () => {
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
          user6StakeConnection.userPublicKey(),
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
          user6StakeConnection.userPublicKey(),
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
      let stakeAccountCheckpointsAddress;
      let proposalIdInput;
      let voteStart;

      // Create 6 checkpoints, 1 second apart
      for (let i = 0; i < 6; i++) {
        stakeAccountCheckpointsAddress = await user7StakeConnection.delegate(
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
        user4StakeConnection.userPublicKey(),
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
          user4StakeConnection.userPublicKey(),
          WHTokenBalance.fromString("5"),
        );
      }
      await sleep(5000);
      while (voteStart >= Math.floor(Date.now() / 1000)) {
        await sleep(1000);
      }

      let currentStakeAccountCheckpointsAddress =
        await user4StakeConnection.getStakeAccountCheckpointsAddress(
          user4StakeConnection.userPublicKey(),
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
          user4StakeConnection.userPublicKey(),
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
          user5StakeConnection.userPublicKey(),
          WHTokenBalance.fromString("5"),
        );
      }

      let user5StakeAccountMetadataAddress =
        await user5StakeConnection.getStakeMetadataAddress(
          user5StakeConnection.userPublicKey(),
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
        user5StakeConnection.userPublicKey(),
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

    it("should fail to castVote with zeroing out the first checkpoint in new checkpoint account", async () => {
      // filling the checkpoint account to the limit
      for (let i = 0; i < TEST_CHECKPOINTS_ACCOUNT_LIMIT - 1; i++) {
        await sleep(1000);
        await user9StakeConnection.delegate(
          user9StakeConnection.userPublicKey(),
          WHTokenBalance.fromString("5"),
        );
      }

      let user9StakeAccountMetadataAddress =
        await user9StakeConnection.getStakeMetadataAddress(
          user9StakeConnection.userPublicKey(),
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
            user9StakeConnection.userPublicKey().toBuffer(),
            Buffer.from([1, 0]),
          ],
          user9StakeConnection.program.programId,
        )[0];

      let user6StakeAccountMetadataAddress =
        await user6StakeConnection.getStakeMetadataAddress(
          user6StakeConnection.userPublicKey(),
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
          user9StakeConnection.userPublicKey(),
          WHTokenBalance.fromString("5").toBN(),
        ),
      );
      instructions.push(
        await user9StakeConnection.program.methods
          .delegate(
            user9StakeConnection.userPublicKey(),
            user9StakeConnection.userPublicKey(),
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
            payer: user9StakeConnection.userPublicKey(),
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
            user6StakeConnection.userPublicKey(),
            user9StakeConnection.userPublicKey(),
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
        user9StakeConnection.userPublicKey(),
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
                user4StakeConnection.userPublicKey(),
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
