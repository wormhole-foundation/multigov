// Usage: npx ts-node app/deploy/devnet/tests/31_tx_list.ts

import { Connection } from "@solana/web3.js";
import { RPC_NODE } from "../constants";
import { getProgramTransactions } from "../../../helpers/utils/parse_transactions";

async function main() {
  const connection = new Connection(RPC_NODE, "confirmed");
  const programId = "AFuHPdrQGsW8rNQ4oEFF35sm5fg36gwrxyqjkjKvi6ap";
  const limit = 15;

  getProgramTransactions(connection, programId, limit)
    .then((transactions) => {
      console.log(
        `Found ${transactions.length} transactions for program ${programId}:`,
      );
      transactions.forEach((tx, index) => {
        console.log(`Transaction ${index + 1}:`);
        console.log("  Signature:", tx.transaction.signatures[0]);
        console.log("  Slot:", tx.slot);
        console.log(
          "  Block Time:",
          tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : "N/A",
        );
        console.log("  Fee:", tx.meta?.fee);
        console.log("---");
      });
    })
    .then(() => console.log("Transactions successfully found."))
    .catch((error) => console.error("Error:", error));
}

main();
