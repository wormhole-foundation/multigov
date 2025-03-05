// Usage: npx ts-node app/deploy/devnet/vesting/delegateWithVest.ts

import { Wallet, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { USER_AUTHORITY_KEYPAIR, RPC_NODE } from "../constants";
import { StakeConnection } from "../../../StakeConnection";
import { WHTokenBalance } from "../../../whTokenBalance";

async function main() {
  const vester = USER_AUTHORITY_KEYPAIR;

  const connection = new Connection(RPC_NODE);
  const vesterProvider = new AnchorProvider(connection, new Wallet(vester), {});
  const vesterStakeConnection = await StakeConnection.createStakeConnection(
    connection,
    vesterProvider.wallet as Wallet,
  );

  const config = new PublicKey("BcJSiMQLggZxJ3v7kLLnQemB7Z6XJABV5Bci5LX7KhA3");

  console.log(`Delegate WH tokens with vests`);
  await vesterStakeConnection.delegateWithVest(
    vester.publicKey,
    WHTokenBalance.fromString("10"),
    true,
    config,
  );
  console.log(`WH tokens with vests successfully delegated`);
}

main();
