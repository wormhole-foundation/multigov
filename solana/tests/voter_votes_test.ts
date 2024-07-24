import {
  ANCHOR_CONFIG_PATH,
  CustomAbortController,
  getPortNumber,
  makeDefaultConfig,
  readAnchorConfig,
  requestWHTokenAirdrop,
  standardSetup,
} from "./utils/before";
import path from "path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { StakeConnection, WHTokenBalance } from "../app";
import { BN, Wallet } from "@coral-xyz/anchor";
import { assertVoterVotesEquals } from "./utils/api_utils";
import * as console from "node:console";

const portNumber = getPortNumber(path.basename(__filename));

describe("voter_votes_test", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();

  let stakeConnection: StakeConnection;
  let controller: CustomAbortController;

  let owner: PublicKey;

  before(async () => {
    const config = readAnchorConfig(ANCHOR_CONFIG_PATH);
    ({ controller, stakeConnection } = await standardSetup(
      portNumber,
      config,
      whMintAccount,
      whMintAuthority,
      makeDefaultConfig(whMintAccount.publicKey)
    ));

    owner = stakeConnection.provider.wallet.publicKey;
  });

  it("delegate votes appear after delegation", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("50")
    );

    let stakeAccount = await stakeConnection.getMainAccount(owner);

    await assertVoterVotesEquals(stakeAccount, new BN("50000000")); // 50 * 10**6

    await stakeConnection.delegate(
      stakeAccount,
      stakeAccount,
      WHTokenBalance.fromString("15")
    );

    stakeAccount = await stakeConnection.getMainAccount(owner);

    await assertVoterVotesEquals(stakeAccount, new BN("65000000")); // 65 * 10**6
  });

  after(async () => {
    controller.abort();
  });
});
