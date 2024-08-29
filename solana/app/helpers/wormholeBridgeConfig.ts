// modified from https://github.com/wormhole-foundation/wormhole/blob/main/sdk/js/src/solana/wormhole/accounts/config.ts
import * as anchor from "@coral-xyz/anchor";
import { getAccountData } from "./utils/account";

export function deriveWormholeBridgeDataKey(
  wormholeProgramId: anchor.web3.PublicKey
): anchor.web3.PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("Bridge")],
    wormholeProgramId
  )[0];
}

export async function getWormholeBridgeData(
  connection: anchor.web3.Connection,
  wormholeProgramId: anchor.web3.PublicKey,
  commitment?: anchor.web3.Commitment
): Promise<BridgeData> {
  return connection
    .getAccountInfo(deriveWormholeBridgeDataKey(wormholeProgramId), commitment)
    .then((info) => BridgeData.deserialize(getAccountData(info)));
}


