// Usage: npx ts-node app/deploy/devnet/tests/23_fetchVoteWeightWindowLengths.ts

import { Wallet, AnchorProvider, utils } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import * as wasm from "@wormhole/staking-wasm";
import {
  DEPLOYER_AUTHORITY_KEYPAIR,
  RPC_NODE,
  VOTE_WEIGHT_WINDOW_LENGTHS,
} from "../constants";
import { StakeConnection } from "../../../StakeConnection";
import {
  readWindowLengths,
  WindowLengthsAccount,
} from "../../../vote_weight_window_lengths";

async function main() {
  const connection = new Connection(RPC_NODE);
  const provider = new AnchorProvider(
    connection,
    new Wallet(DEPLOYER_AUTHORITY_KEYPAIR),
    {},
  );
  const stakeConnection = await StakeConnection.createStakeConnection(
    connection,
    provider.wallet as Wallet,
  );

  console.log("VOTE_WEIGHT_WINDOW_LENGTHS:", VOTE_WEIGHT_WINDOW_LENGTHS);

  const [voteWeightWindowLengthsAccountAddress, _] =
    PublicKey.findProgramAddressSync(
      [
        utils.bytes.utf8.encode(
          wasm.Constants.VOTE_WEIGHT_WINDOW_LENGTHS_SEED(),
        ),
      ],
      stakeConnection.program.programId,
    );
  console.log(
    "voteWeightWindowLengthsAccountAddress:",
    voteWeightWindowLengthsAccountAddress,
  );

  let windowLengthsAccount: WindowLengthsAccount = await readWindowLengths(
    connection,
    voteWeightWindowLengthsAccountAddress,
  );
  console.log(
    "windowLengthsAccount.getWindowLengthCount():",
    windowLengthsAccount.getWindowLengthCount(),
  );
  console.log(
    "windowLengthsAccount.voteWeightWindowLengths.nextIndex:",
    windowLengthsAccount.voteWeightWindowLengths.nextIndex,
  );
  console.log(
    "windowLengthsAccount.getLastWindowLength().value.toString():",
    windowLengthsAccount.getLastWindowLength()?.value.toString(),
  );
}

main();
