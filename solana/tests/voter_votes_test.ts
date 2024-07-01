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

const portNumber = getPortNumber(path.basename(__filename));

describe("voter_votes_test", async () => {
  const whMintAccount = new Keypair();
  const whMintAuthority = new Keypair();

  let stakeConnection: StakeConnection;
  let controller: CustomAbortController;

  let owner: PublicKey;

  before(async () => {
    const config = readAnchorConfig(ANCHOR_CONFIG_PATH);
    const governanceProgram = new PublicKey(
      config.programs.localnet.governance
    );
    ({ controller, stakeConnection } = await standardSetup(
      portNumber,
      config,
      whMintAccount,
      whMintAuthority,
      makeDefaultConfig(whMintAccount.publicKey, governanceProgram)
    ));

    owner = stakeConnection.provider.wallet.publicKey;
  });

  it("Delegate votes appear after delegation", async () => {
    await stakeConnection.delegate(
      undefined,
      undefined,
      WHTokenBalance.fromString("100")
    );

    await assertVoterVotesEquals(stakeConnection, owner, new BN(100));
  });

  after(async () => {
    controller.abort();
  });
});
