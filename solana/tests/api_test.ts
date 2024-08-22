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

const portNumber = getPortNumber(path.basename(__filename));

describe("api", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();

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
