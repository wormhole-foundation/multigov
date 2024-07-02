import { StakeConnection } from "../../app/StakeConnection";
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

async function assertVoterVotesEquals(
  stakeConnection: StakeConnection,
  owner: PublicKey,
  expectedVoterVotes: BN
) {
  const stakeAccount = await stakeConnection.getMainAccount(owner);

  const currentActual = await stakeAccount.getVoterWeight();
  assert.equal(currentActual.toBN().toString(), expectedVoterVotes.toString());
}
