import { Keypair } from "@solana/web3.js";
import assert from "assert";
import { StakeConnection } from "../app/StakeConnection";
import {
  standardSetup,
  readAnchorConfig,
  getPortNumber,
  ANCHOR_CONFIG_PATH,
  makeDefaultConfig,
  newUserStakeConnection,
} from "./utils/before";
import BN from "bn.js";
import path from "path";
import { expectFailApi } from "./utils/utils";
import { assertBalanceMatches } from "./utils/api_utils";
import { WHTokenBalance } from "../app";
import crypto from 'crypto';
import {
  signaturesToSolanaArray,
} from "@wormhole-foundation/wormhole-query-sdk";

const portNumber = getPortNumber(path.basename(__filename));

describe("api", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();

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
      makeDefaultConfig(whMintAccount.publicKey),
      WHTokenBalance.fromString("1000"),
    ));
    owner = stakeConnection.provider.wallet.publicKey;

    user2StakeConnection = await newUserStakeConnection(
      stakeConnection,
      config,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );
    user2 = user2StakeConnection.provider.wallet.publicKey;

    user3StakeConnection = await newUserStakeConnection(
      stakeConnection,
      config,
      whMintAccount,
      whMintAuthority,
      WHTokenBalance.fromString("1000"),
    );
    user3 = user3StakeConnection.provider.wallet.publicKey;
  });

  it("postSignatures", async () => {
    const signaturesKeypair = Keypair.generate();
    await stakeConnection.postSignatures(ethProposalResponse.signatures, signaturesKeypair);
    const { guardianSignaturesData } =await stakeConnection.fetchGuardianSignaturesData(signaturesKeypair.publicKey);
    const expectedSignatures = signaturesToSolanaArray(ethProposalResponse.signatures);
    assert.equal(
      Buffer.from(guardianSignaturesData.guardianSignatures[1]).toString('hex'),
      Buffer.from(expectedSignatures[1]).toString('hex'),
    );
  });

  it("addProposal", async () => {
    const proposalId = crypto.createHash('sha256').update('proposalId1').digest();
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24 * 60 * 60); // 24 hour

    await stakeConnection.addProposal(proposalId, voteStart, safeWindow);
    const { proposalAccountData } =
      await stakeConnection.fetchProposalAccountData(proposalId);
    assert.equal(Buffer.from(proposalAccountData.id).toString('hex'), proposalId.toString('hex'));
    assert.equal(
      proposalAccountData.voteStart.toString(),
      voteStart.toString(),
    );
    assert.equal(
      proposalAccountData.safeWindow.toString(),
      safeWindow.toString(),
    );
    assert.equal(proposalAccountData.againstVotes.toString(), "0");
    assert.equal(proposalAccountData.forVotes.toString(), "0");
    assert.equal(proposalAccountData.abstainVotes.toString(), "0");
  });

  it("proposalVotes", async () => {
    const _proposalId = crypto.createHash('sha256').update('proposalId2').digest();
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24 * 60 * 60); // 24 hour

    await stakeConnection.addProposal(_proposalId, voteStart, safeWindow);

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await stakeConnection.proposalVotes(_proposalId);

    assert.equal(proposalId.toString('hex'), _proposalId.toString('hex'));
    assert.equal(againstVotes.toString(), "0");
    assert.equal(forVotes.toString(), "0");
    assert.equal(abstainVotes.toString(), "0");
  });

  it("isVotingSafe", async () => {
    const proposalId = crypto.createHash('sha256').update('proposalId3').digest();
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24 * 60 * 60); // 24 hour

    await stakeConnection.addProposal(proposalId, voteStart, safeWindow);

    assert.equal(await stakeConnection.isVotingSafe(proposalId), true);
  });

  it("delegate", async () => {
    let stakeAccountAddress =
      await stakeConnection.getMainAccountAddress(owner);
    stakeAccountAddress = await stakeConnection.delegate(
      stakeAccountAddress,
      stakeAccountAddress,
      WHTokenBalance.fromString("100"),
    );

    await stakeConnection.delegate(
      stakeAccountAddress,
      stakeAccountAddress,
      WHTokenBalance.fromString("100"),
    );

    await stakeConnection.delegate(
      stakeAccountAddress,
      undefined,
      WHTokenBalance.fromString("100"),
    );
  });

  it("should delegate to the user stack account if delegate is not defined", async () => {
    const stakeAccountAddress = await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("100"),
    );

    const delegate = await stakeConnection.delegates(stakeAccountAddress);
    assert.equal(delegate.toBase58(), stakeAccountAddress.toBase58());
  });

  it("should change delegate account correctly", async () => {
    let stakeAccountAddress =
      await stakeConnection.getMainAccountAddress(owner);
    stakeAccountAddress = await stakeConnection.delegate(
      stakeAccountAddress,
      undefined,
      WHTokenBalance.fromString("10"),
    );

    const stakeAccountAddress2 = await user2StakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("10"),
    );

    const stakeAccountAddress3 = await user3StakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("10"),
    );

    await stakeConnection.delegate(
      stakeAccountAddress,
      stakeAccountAddress2,
      WHTokenBalance.fromString("10"),
    );

    delegate = await stakeConnection.delegates(stakeAccountAddress);
    assert.equal(delegate.toBase58(), stakeAccountAddress2.toBase58());

    await stakeConnection.delegate(
      stakeAccountAddress,
      stakeAccountAddress3,
      WHTokenBalance.fromString("10"),
    );

    delegate = await stakeConnection.delegates(stakeAccountAddress);
    assert.equal(delegate.toBase58(), stakeAccountAddress3.toBase58());
  });

  it("withdrawTokens", async () => {
    let stakeAccountAddress =
      await stakeConnection.getMainAccountAddress(owner);
    let stakeAccount =
      await stakeConnection.loadStakeAccount(stakeAccountAddress);
    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "130000000", // 130 * 10**6
    );

    stakeAccountAddress = await stakeConnection.delegate(
      stakeAccountAddress,
      undefined,
      WHTokenBalance.fromString("100"),
    );

    stakeAccount = await stakeConnection.loadStakeAccount(stakeAccountAddress);
    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "230000000", // 230 * 10**6
    );

    await stakeConnection.withdrawTokens(
      stakeAccount,
      WHTokenBalance.fromString("50"),
    );

    stakeAccount = await stakeConnection.loadStakeAccount(stakeAccountAddress);
    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "180000000", // 180 * 10**6
    );
  });

  it("find and parse stake accounts", async () => {
    const res = await stakeConnection.getStakeAccounts(owner);
    assert.equal(res.length, 2);

    let stakeAccountAddress =
      await stakeConnection.getMainAccountAddress(owner);
    let stakeAccount =
      await stakeConnection.loadStakeAccount(stakeAccountAddress);

    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "180000000", // 180 * 10**6
    );

    stakeAccountAddress = await stakeConnection.delegate(
      stakeAccountAddress,
      undefined,
      WHTokenBalance.fromString("100"),
    );

    stakeAccount = await stakeConnection.loadStakeAccount(stakeAccountAddress);
    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "280000000", // 280 * 10**6
    );

    assert.equal(
      stakeAccount.stakeAccountMetadata.owner.toBase58(),
      owner.toBase58(),
    );

    await assertBalanceMatches(
      stakeConnection,
      owner,
      WHTokenBalance.fromString("280"),
    );
  });

  it("castVote", async () => {
    let stakeAccountAddress =
      await user2StakeConnection.getMainAccountAddress(user2);

    stakeAccountAddress = await user2StakeConnection.delegate(
      stakeAccountAddress,
      undefined,
      WHTokenBalance.fromString("150"),
    );

    const _proposalId = crypto.createHash('sha256').update('proposalId4').digest();
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24 * 60 * 60); // 24 hour

    await user2StakeConnection.addProposal(_proposalId, voteStart, safeWindow);

    await user2StakeConnection.delegate(
      stakeAccountAddress,
      undefined,
      WHTokenBalance.fromString("200"),
    );

    await user2StakeConnection.castVote(
      _proposalId,
      stakeAccountAddress,
      new BN(10),
      new BN(20),
      new BN(12),
    );
    await user2StakeConnection.castVote(
      _proposalId,
      stakeAccountAddress,
      new BN(10),
      new BN(10),
      new BN(0),
    );
    await user2StakeConnection.castVote(
      _proposalId,
      stakeAccountAddress,
      new BN(0),
      new BN(7),
      new BN(10),
    );

    const { proposalId, againstVotes, forVotes, abstainVotes } =
      await user2StakeConnection.proposalVotes(_proposalId);

    assert.equal(proposalId.toString('hex'), _proposalId.toString('hex'));
    assert.equal(againstVotes.toString(), "20");
    assert.equal(forVotes.toString(), "37");
    assert.equal(abstainVotes.toString(), "22");
  });
});
