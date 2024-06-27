import { StakeConnection } from "../../app/StakeConnection";
import {
  PublicKey,
} from "@solana/web3.js";
import BN from "bn.js";
import { WHTokenBalance } from "../../app";

/**
 * Asserts that `owner` has 1 single stake account and its balance summary is equal to an `expected` value
 */
export async function assertBalanceMatches(
  stakeConnection: StakeConnection,
  owner: PublicKey,
  expected: WHTokenBalance,
  currentTime: BN
) {
  const stakeAccount = await stakeConnection.getMainAccount(owner);
  const balanceSummary = stakeAccount.getBalanceSummary(currentTime);
  assert.equal(
    balanceSummary.balance.toString(),
    expected.toString(),
    "Balance"
  );
}

async function assertVoterVotesEquals(
  stakeConnection: StakeConnection,
  owner: PublicKey,
  expectedVoterVotes: BN,
) {
  const stakeAccount = await stakeConnection.getMainAccount(owner);

  const currentActual = await stakeAccount.getVoterWeight();
  assert.equal(currentActual.toBN().toString(), expectedVoterVotes.toString());
}
