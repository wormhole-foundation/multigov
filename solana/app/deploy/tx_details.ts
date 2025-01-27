import { Connection } from "@solana/web3.js";
import { RPC_NODE } from "./devnet";
import {
  getProgramTransactions,
  printTransactionDetails,
} from "../utils/parse_transactions";

async function main() {
  const connection = new Connection(RPC_NODE, "confirmed");
  const programId = "AFuHPdrQGsW8rNQ4oEFF35sm5fg36gwrxyqjkjKvi6ap";
  const limit = 2;

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

      const signature = tx.transaction.signatures[0];
      await printTransactionDetails(connection, signature);
      console.log("-------------------------------------");
    }

    console.log("Transaction details fetched successfully.");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
