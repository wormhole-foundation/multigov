// Usage: npx ts-node app/deploy/052_tx_events.ts

import { Connection } from "@solana/web3.js";
import { RPC_NODE } from "./devnet_consts";
import {
  getProgramTransactions,
  printTransactionEvents,
} from "../utils/parse_transactions";

async function main() {
  const connection = new Connection(RPC_NODE, "confirmed");
  //   const transactionSignature = '3er1rCAdfVkKjmyURX4HJJxqFsY4EjnCdyC3M4NCqMb4RErKh7USgacYQAsb42W6Syf9Dx1hn4kk3wzSPQrcGpsw';
  //   await printTransactionEvents(connection, transactionSignature);

  const programId = "DgCSKsLDXXufYeEkvf21YSX5DMnFK89xans5WdSsUbeY";
  const limit = 3;

  try {
    const transactions = await getProgramTransactions(
      connection,
      programId,
      limit,
    );
    console.log(
      `Found ${transactions.length} transactions for program ${programId}\n`,
    );

    for (const [index, tx] of transactions.entries()) {
      console.log(`Transaction ${index + 1} details:\n`);
      await printTransactionEvents(connection, tx.transaction.signatures[0]);
      console.log("-------------------------------------");
    }

    console.log("Transaction events printed successfully.");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
