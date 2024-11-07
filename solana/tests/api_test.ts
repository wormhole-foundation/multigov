import { Keypair } from "@solana/web3.js";
import assert from "assert";
import { StakeConnection } from "../app/StakeConnection";
import {
  ANCHOR_CONFIG_PATH,
  getPortNumber,
  makeTestConfig,
  newUserStakeConnection,
  readAnchorConfig,
  standardSetup,
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
import { WHTokenBalance } from "../app";
import crypto from "crypto";
import {
  QueryProxyMock,
  signaturesToSolanaArray,
} from "@wormhole-foundation/wormhole-query-sdk";
import { AnchorError } from "@coral-xyz/anchor";

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

  let controller;
  let owner;
  let user2;
  let user3;
  let delegate;

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
  });

  it("postSignatures", async () => {
    const signaturesKeypair = Keypair.generate();
    await stakeConnection.postSignatures(
      ethProposalResponse.signatures,
      signaturesKeypair,
    );
    const { guardianSignaturesData } =
      await stakeConnection.fetchGuardianSignaturesData(
        signaturesKeypair.publicKey,
      );
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

      const signaturesKeypair = Keypair.generate();
      await stakeConnection.postSignatures(
        sepoliaEthProposalResponse.signatures,
        signaturesKeypair,
      );

      await stakeConnection.addProposal(
        proposalIdArray,
        Buffer.from(sepoliaEthProposalResponse.bytes, "hex"),
        signaturesKeypair.publicKey,
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

      const signaturesKeypair = Keypair.generate();
      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(nonFinalizedEthProposalResponseBytes);
      await stakeConnection.postSignatures(mockSignatures, signaturesKeypair);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          nonFinalizedEthProposalResponseBytes,
          signaturesKeypair.publicKey,
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

      const signaturesKeypair = Keypair.generate();
      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(invalidQueryEthProposalResponseBytes);
      await stakeConnection.postSignatures(mockSignatures, signaturesKeypair);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          invalidQueryEthProposalResponseBytes,
          signaturesKeypair.publicKey,
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

      const signaturesKeypair = Keypair.generate();
      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(invalidResponseEthProposalResponseBytes);
      await stakeConnection.postSignatures(mockSignatures, signaturesKeypair);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          invalidResponseEthProposalResponseBytes,
          signaturesKeypair.publicKey,
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

      const signaturesKeypair = Keypair.generate();
      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(
        invalidFunctionSignatureEthProposalResponseBytes,
      );
      await stakeConnection.postSignatures(mockSignatures, signaturesKeypair);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          invalidFunctionSignatureEthProposalResponseBytes,
          signaturesKeypair.publicKey,
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
      const signaturesKeypair = Keypair.generate();
      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(ethProposalResponseBytes);
      await stakeConnection.postSignatures(mockSignatures, signaturesKeypair);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          ethProposalResponseBytes,
          signaturesKeypair.publicKey,
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
      const signaturesKeypair = Keypair.generate();
      const mock = new QueryProxyMock({});
      const mockSignatures = mock.sign(ethProposalResponseBytes);
      await stakeConnection.postSignatures(mockSignatures, signaturesKeypair);
      const mockGuardianSetIndex = 5;

      try {
        await stakeConnection.addProposal(
          proposalIdInput,
          ethProposalResponseBytes,
          signaturesKeypair.publicKey,
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

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await stakeConnection.proposalVotes(proposalIdInput);

    assert.equal(proposalId.toString("hex"), proposalIdInput.toString("hex"));
    assert.equal(againstVotes.toString(), "0");
    assert.equal(forVotes.toString(), "0");
    assert.equal(abstainVotes.toString(), "0");
  });

  it("delegate", async () => {
    await stakeConnection.delegate(owner, WHTokenBalance.fromString("100"));

    await stakeConnection.delegate(owner, WHTokenBalance.fromString("100"));

    await stakeConnection.delegate(owner, WHTokenBalance.fromString("100"));
  });

  it("should change delegate account correctly", async () => {
    let stakeAccountCheckpointsAddress = await stakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("10"),
    );
    let user2stakeAccountCheckpointsAddress =
      await user2StakeConnection.delegate(
        undefined,
        WHTokenBalance.fromString("10"),
      );
    await stakeConnection.delegate(user2, WHTokenBalance.fromString("10"));
    delegate = await stakeConnection.delegates(stakeAccountCheckpointsAddress);

    assert.equal(delegate.toBase58(), user2.toBase58());
  });

  it("should fail when delegating with an invalid current delegate", async () => {
    await user2StakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("10"),
    );

    let stakeAccountCheckpointsAddress = await stakeConnection.delegate(
      user2,
      WHTokenBalance.fromString("10"),
    );

    const user3StakeAccountAddress = await user3StakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("10"),
    );

    let stakeAccountCheckpointsData =
      await stakeConnection.program.account.checkpointData.fetch(
        stakeAccountCheckpointsAddress,
      );

    let user3StakeAccountAddressData =
      await stakeConnection.program.account.checkpointData.fetch(
        user3StakeAccountAddress,
      );

    try {
      await stakeConnection.program.methods
        .delegate(
          stakeAccountCheckpointsData.owner,
          user3StakeAccountAddressData.owner,
        )
        .accounts({
          currentDelegateStakeAccountCheckpoints:
            stakeAccountCheckpointsAddress, // Invalid delegate
          delegateeStakeAccountCheckpoints: user3StakeAccountAddress,
          vestingConfig: null,
          vestingBalance: null,
          mint: stakeConnection.config.whTokenMint,
        })
        .rpc();

      assert.fail("Expected an error but none was thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "InvalidCurrentDelegate",
      );
    }
  });

  it("withdrawTokens", async () => {
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
      "330000000", // 330 * 10**6
    );

    await stakeConnection.delegate(undefined, WHTokenBalance.fromString("100"));

    stakeAccount = await stakeConnection.loadStakeAccount(
      stakeAccountCheckpointsAddress,
    );
    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "430000000", // 430 * 10**6
    );

    await stakeConnection.withdrawTokens(
      stakeAccount,
      WHTokenBalance.fromString("50"),
    );

    stakeAccount = await stakeConnection.loadStakeAccount(
      stakeAccountCheckpointsAddress,
    );
    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "380000000", // 380 * 10**6
    );
  });

  it("should fail when withdrawal with an invalid current delegate", async () => {
    await user2StakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("10"),
    );

    let stakeAccountCheckpointsAddress = await stakeConnection.delegate(
      user2,
      WHTokenBalance.fromString("10"),
    );

    const toAccount = await getAssociatedTokenAddress(
      stakeConnection.config.whTokenMint,
      owner,
      true,
    );

    let stakeAccountCheckpointsData =
      await stakeConnection.program.account.checkpointData.fetch(
        stakeAccountCheckpointsAddress,
      );

    try {
      await stakeConnection.program.methods
        .withdrawTokens(
          WHTokenBalance.fromString("5").toBN(),
          stakeAccountCheckpointsData.owner,
          stakeAccountCheckpointsData.owner,
        )
        .accounts({
          currentDelegateStakeAccountCheckpoints:
            stakeAccountCheckpointsAddress, // Invalid delegate
          destination: toAccount,
        })
        .rpc();

      assert.fail("Expected an error but none was thrown");
    } catch (e) {
      assert(
        (e as AnchorError).error?.errorCode?.code === "InvalidCurrentDelegate",
      );
    }
  });

  it("castVote", async () => {
    let user2StakeAccountCheckpointsAddress =
      await user2StakeConnection.delegate(
        user2,
        WHTokenBalance.fromString("150"),
      );

    const proposalIdInput = crypto
      .createHash("sha256")
      .update("proposalId4")
      .digest();
    const voteStart = Math.floor(Date.now() / 1000);

    const ethProposalResponseBytes = createProposalQueryResponseBytes(
      proposalIdInput,
      voteStart,
    );
    const signaturesKeypair = Keypair.generate();
    const mock = new QueryProxyMock({});
    const mockSignatures = mock.sign(ethProposalResponseBytes);
    await user2StakeConnection.postSignatures(
      mockSignatures,
      signaturesKeypair,
    );
    const mockGuardianSetIndex = 5;

    await user2StakeConnection.addProposal(
      proposalIdInput,
      ethProposalResponseBytes,
      signaturesKeypair.publicKey,
      mockGuardianSetIndex,
    );

    await user2StakeConnection.castVote(
      proposalIdInput,
      user2StakeAccountCheckpointsAddress,
      new BN(10),
      new BN(20),
      new BN(12),
      0,
    );
    await user2StakeConnection.castVote(
      proposalIdInput,
      user2StakeAccountCheckpointsAddress,
      new BN(10),
      new BN(10),
      new BN(0),
      0,
    );
    await user2StakeConnection.castVote(
      proposalIdInput,
      user2StakeAccountCheckpointsAddress,
      new BN(0),
      new BN(7),
      new BN(10),
      0,
    );

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await user2StakeConnection.proposalVotes(proposalIdInput);

    assert.equal(proposalId.toString("hex"), proposalIdInput.toString("hex"));
    assert.equal(againstVotes.toString(), "20");
    assert.equal(forVotes.toString(), "37");
    assert.equal(abstainVotes.toString(), "22");
  });

  it("should fail when castVote with an invalid voter checkpoints", async () => {
    let stakeAccountCheckpointsAddress = await stakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("150"),
    );

    let user2StakeAccountCheckpointsAddress =
      await user2StakeConnection.delegate(
        undefined,
        WHTokenBalance.fromString("150"),
      );

    const proposalIdInput = crypto
      .createHash("sha256")
      .update("proposalId5")
      .digest();
    const voteStart = Math.floor(Date.now() / 1000);

    const ethProposalResponseBytes = createProposalQueryResponseBytes(
      proposalIdInput,
      voteStart,
    );
    const signaturesKeypair = Keypair.generate();
    const mock = new QueryProxyMock({});
    const mockSignatures = mock.sign(ethProposalResponseBytes);
    await user2StakeConnection.postSignatures(
      mockSignatures,
      signaturesKeypair,
    );
    const mockGuardianSetIndex = 5;

    await user2StakeConnection.addProposal(
      proposalIdInput,
      ethProposalResponseBytes,
      signaturesKeypair.publicKey,
      mockGuardianSetIndex,
    );

    await user2StakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("200"),
    );

    const { proposalAccount } =
      await user2StakeConnection.fetchProposalAccount(proposalIdInput);

    try {
      await user2StakeConnection.program.methods
        .castVote(
          Array.from(proposalIdInput),
          new BN(10),
          new BN(20),
          new BN(12),
          0,
        )
        .accountsPartial({
          proposal: proposalAccount,
          voterCheckpoints: stakeAccountCheckpointsAddress,
        })
        .rpc();

      assert.fail("Expected an error but none was thrown");
    } catch (e) {
      assert((e as AnchorError).error?.errorCode?.code === "ConstraintSeeds");
    }
  });
});
