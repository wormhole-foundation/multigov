import * as anchor from "@coral-xyz/anchor";

export function getAccountData(
  info: anchor.web3.AccountInfo<Buffer> | null,
): Buffer {
  if (info === null) {
    throw Error("account info is null");
  }
  return info.data;
}
