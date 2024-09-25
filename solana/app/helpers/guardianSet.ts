// modified from https://github.com/wormhole-foundation/wormhole/blob/main/sdk/js/src/solana/wormhole/accounts/guardianSet.ts
import * as anchor from "@coral-xyz/anchor";

export function deriveGuardianSetKey(
  wormholeProgramId: anchor.web3.PublicKey,
  index: number
): anchor.web3.PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("GuardianSet"),
      (() => {
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(index);
        return buf;
      })(),
    ],
    wormholeProgramId
  )[0];
}
