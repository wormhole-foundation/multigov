import { Keypair } from "@solana/web3.js";
import assert from "assert";
import { StakeConnection } from "../app/StakeConnection";
import {
  standardSetup,
  readAnchorConfig,
  getPortNumber,
  ANCHOR_CONFIG_PATH,
  makeDefaultConfig,
} from "./utils/before";
import {} from "../../staking/tests/utils/before";
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

  let controller;
  let owner;

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
      WHTokenBalance.fromString("1000")
    ));

    owner = stakeConnection.provider.wallet.publicKey;
  });

  it("addProposal", async () => {
    const proposal = new BN(1);
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24*60*60); // 24 hour

    await stakeConnection.addProposal(proposal, voteStart, safeWindow);

    const { proposalAccountData } = await stakeConnection.fetchProposalAccountData(proposal);

    assert.equal(proposalAccountData.id.toString(), proposal.toString());
    assert.equal(proposalAccountData.voteStart.toString(), voteStart.toString());
    assert.equal(proposalAccountData.safeWindow.toString(), safeWindow.toString());
    assert.equal(proposalAccountData.againstVotes.toString(), '0');
    assert.equal(proposalAccountData.forVotes.toString(), '0');
    assert.equal(proposalAccountData.abstainVotes.toString(), '0');
  });

  it("proposalVotes", async () => {
    const proposal = new BN(2);
    const voteStart = new BN(Math.floor(Date.now() / 1000));
    const safeWindow = new BN(24*60*60); // 24 hour

    await stakeConnection.addProposal(proposal, voteStart, safeWindow);

    const { againstVotes, forVotes, abstainVotes } = await stakeConnection.proposalVotes(proposal);
    assert.equal(againstVotes.toString(), '0');
    assert.equal(forVotes.toString(), '0');
    assert.equal(abstainVotes.toString(), '0');
  });

  it("delegate", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("100")
    );

    const stakeAccount = await stakeConnection.getMainAccount(owner);

    await stakeConnection.delegate(
      stakeAccount,
      stakeAccount,
      WHTokenBalance.fromString("100")
    );

    await stakeConnection.delegate(
      stakeAccount,
      undefined,
      WHTokenBalance.fromString("100")
    );
  });

  it("default delegates", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("100")
    );

    const stakeAccount = await stakeConnection.getMainAccount(owner);
    const delegate = await stakeConnection.delegates(stakeAccount);
    assert.equal(
      delegate.toBase58(),
      stakeAccount.address.toBase58()
    );
  });

  it("find and parse stake accounts", async () => {
    const res = await stakeConnection.getStakeAccounts(owner);
    assert.equal(res.length, 2);

    let stakeAccount = await stakeConnection.getMainAccount(owner);

    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "300000000" // 300 * 10**6
    );
    
    await stakeConnection.delegate(
      stakeAccount,
      stakeAccount,
      WHTokenBalance.fromString("100")
    );

    stakeAccount = await stakeConnection.getMainAccount(owner);

    assert.equal(
      stakeAccount.tokenBalance.toString(),
      "400000000" // 400 * 10**6
    );

    assert.equal(
      stakeAccount.stakeAccountMetadata.owner.toBase58(),
      owner.toBase58()
    );

    await assertBalanceMatches(
      stakeConnection,
      owner,
      { balance: WHTokenBalance.fromString("400") }
    );
  });
});
