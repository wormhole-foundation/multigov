import { StakeAccount, StakeConnection } from "../../app/StakeConnection";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { WHTokenBalance } from "../../app";
import assert from "assert";

/**
 * Asserts that `owner` has 1 single stake account and its balance summary is equal to an `expected` value
 */
export async function assertBalanceMatches(
  stakeConnection: StakeConnection,
  owner: PublicKey,
  expected: WHTokenBalance
) {
  const stakeAccount = await stakeConnection.getMainAccount(owner);
  const balanceSummary = stakeAccount.getBalanceSummary();
  assert.equal(
    balanceSummary.balance.toString(),
    expected.balance.toString()
  );
}

export async function assertVoterVotesEquals(
  stakeAccount: StakeAccount,
  expectedVoterVotes: BN
) {
  const currentActual = await stakeAccount.getVotes();
  assert.equal(currentActual.toString(), expectedVoterVotes.toString());
}
