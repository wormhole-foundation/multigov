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

  it("Delegate", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("600")
    );

    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("100")
    );
  });

  it("Default delegates", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("200")
    );

    const stakeAccount = await stakeConnection.getMainAccount(owner);
    const delegate = await stakeConnection.delegates(stakeAccount);
    assert(delegate.eq(owner));
  });

  it("Find and parse stake accounts", async () => {
    const res = await stakeConnection.getStakeAccounts(owner);
    assert.equal(res.length, 3);

    const stakeAccount = await stakeConnection.getMainAccount(owner);

    assert(stakeAccount.tokenBalance.eq(WHTokenBalance.fromString("600").toBN()));

    assert.equal(
      stakeAccount.stakeAccountMetadata.owner.toBase58(),
      owner.toBase58()
    );

    assert(stakeAccount.tokenBalance.eq(WHTokenBalance.fromString("600").toBN()));
    await assertBalanceMatches(
      stakeConnection,
      owner,
      { balance: WHTokenBalance.fromString("600") },
      await stakeConnection.getTime()
    );
  });
});
