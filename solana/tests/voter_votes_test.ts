import {
  ANCHOR_CONFIG_PATH,
  CustomAbortController,
  getPortNumber,
  makeDefaultConfig,
  readAnchorConfig,
  standardSetup,
} from "./utils/before";
import path from "path";
import { Keypair, PublicKey } from "@solana/web3.js";
import { StakeConnection, WHTokenBalance } from "../app";
import assert from "assert";

const portNumber = getPortNumber(path.basename(__filename));

describe("voter_votes_test", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();
  const governanceAuthority = new Keypair();

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
      governanceAuthority,
      makeDefaultConfig(whMintAccount.publicKey),
    ));

    owner = stakeConnection.provider.wallet.publicKey;
  });

  it("delegate votes appear after delegation", async () => {
    let stakeAccountCheckpointsAddress = await stakeConnection.delegate(
      undefined,
      WHTokenBalance.fromString("50"),
    );

    let stakeAccount = await stakeConnection.loadStakeAccount(
      stakeAccountCheckpointsAddress,
    );
    assert.equal(
      stakeAccount.checkpointAccount.getLastCheckpoint().value.toString(),
      "50000000",
    );

    await stakeConnection.delegate(owner, WHTokenBalance.fromString("15"));

    stakeAccount = await stakeConnection.loadStakeAccount(
      stakeAccountCheckpointsAddress,
    );
    assert.equal(
      stakeAccount.checkpointAccount.getLastCheckpoint().value.toString(),
      "65000000",
    );
  });

  after(async () => {
    controller.abort();
  });
});
