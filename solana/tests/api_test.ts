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
    const proposalId = new BN(1);
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24 * 60 * 60); // 24 hour

    await stakeConnection.addProposal(proposalId, voteStart, safeWindow);
    const { proposalAccountData } =
      await stakeConnection.fetchProposalAccountData(proposalId);
    assert.equal(proposalAccountData.id.toString(), proposalId.toString());
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
    const proposalId = new BN(2);
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24 * 60 * 60); // 24 hour

    await stakeConnection.addProposal(proposalId, voteStart, safeWindow);

    const { againstVotes, forVotes, abstainVotes } =
      await stakeConnection.proposalVotes(proposalId);
    assert.equal(againstVotes.toString(), "0");
    assert.equal(forVotes.toString(), "0");
    assert.equal(abstainVotes.toString(), "0");
  });

  it("isVotingSafe", async () => {
    const proposalId = new BN(3);
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24 * 60 * 60); // 24 hour

    await stakeConnection.addProposal(proposalId, voteStart, safeWindow);

    assert.equal(await stakeConnection.isVotingSafe(proposalId), true);
  });

  it("delegate", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("100"),
    );

    const stakeAccount = await stakeConnection.getMainAccount(owner);

    await stakeConnection.delegate(
      stakeAccount.address,
      stakeAccount.address,
      WHTokenBalance.fromString("100"),
    );

    await stakeConnection.delegate(
      stakeAccount.address,
      undefined,
      WHTokenBalance.fromString("100"),
    );
  });

  it("should delegate to the user stack account if delegate is not defined", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("100"),
    );

    const stakeAccount = await stakeConnection.getMainAccount(owner);
    const delegate = await stakeConnection.delegates(stakeAccount.address);
    assert.equal(delegate.toBase58(), stakeAccount.address.toBase58());
  });

  it("should change delegate account correctly", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("10"),
    );

    await user2StakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("10"),
    );

    await user3StakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("10"),
    );

    const stakeAccount = await stakeConnection.getMainAccount(owner);
    const stakeAccount2 = await stakeConnection.getMainAccount(user2);
    const stakeAccount3 = await stakeConnection.getMainAccount(user3);

    await stakeConnection.delegate(
      stakeAccount.address,
      stakeAccount2.address,
      WHTokenBalance.fromString("10"),
    );

    delegate = await stakeConnection.delegates(stakeAccount.address);
    assert.equal(delegate.toBase58(), stakeAccount2.address.toBase58());

    await stakeConnection.delegate(
      stakeAccount.address,
      stakeAccount3.address,
      WHTokenBalance.fromString("10"),
    );

    delegate = await stakeConnection.delegates(stakeAccount.address);
    assert.equal(delegate.toBase58(), stakeAccount3.address.toBase58());
  });

  it("withdrawTokens", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("100"),
    );

    let stakeAccount = await stakeConnection.getMainAccount(owner);

    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "100000000", // 100 * 10**6
    );

    await stakeConnection.withdrawTokens(
      stakeAccount,
      WHTokenBalance.fromString("50"),
    );

    stakeAccount = await stakeConnection.getMainAccount(owner);

    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "50000000", // 50 * 10**6
    );
  });

  it("find and parse stake accounts", async () => {
    const res = await stakeConnection.getStakeAccounts(owner);
    assert.equal(res.length, 4);

    let stakeAccount = await stakeConnection.getMainAccount(owner);

    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "30000000", // 30 * 10**6
    );

    await stakeConnection.delegate(
      stakeAccount.address,
      stakeAccount.address,
      WHTokenBalance.fromString("100"),
    );

    stakeAccount = await stakeConnection.getMainAccount(owner);

    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "100000000", // 100 * 10**6
    );

    assert.equal(
      stakeAccount.stakeAccountMetadata.owner.toBase58(),
      owner.toBase58(),
    );

    await assertBalanceMatches(
      stakeConnection,
      owner,
      WHTokenBalance.fromString("100"),
    );
  });

  it("castVote", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("50"),
    );

    const proposalId = new BN(4);
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24 * 60 * 60); // 24 hour

    await stakeConnection.addProposal(proposalId, voteStart, safeWindow);

    let stakeAccount = await stakeConnection.getMainAccount(owner);

    await stakeConnection.delegate(
      stakeAccount.address,
      stakeAccount.address,
      WHTokenBalance.fromString("100"),
    );

    await stakeConnection.castVote(
      proposalId,
      stakeAccount.address,
      new BN(10),
      new BN(20),
      new BN(12),
    );
    await stakeConnection.castVote(
      proposalId,
      stakeAccount.address,
      new BN(10),
      new BN(10),
      new BN(0),
    );
    await stakeConnection.castVote(
      proposalId,
      stakeAccount.address,
      new BN(0),
      new BN(7),
      new BN(10),
    );

    const { againstVotes, forVotes, abstainVotes } =
      await stakeConnection.proposalVotes(proposalId);
    assert.equal(againstVotes.toString(), "20");
    assert.equal(forVotes.toString(), "37");
    assert.equal(abstainVotes.toString(), "22");
  });
});
