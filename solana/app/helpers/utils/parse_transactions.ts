import {
  Connection,
  PublicKey,
  ConfirmedSignatureInfo,
  ParsedTransactionWithMeta,
  TransactionSignature,
} from "@solana/web3.js";
import { BorshCoder } from "@coral-xyz/anchor";
import IDL from "../../target/idl/staking.json";

// Gets program transactions
export async function getProgramTransactions(
  connection: Connection,
  programId: string,
  limit: number = 10,
): Promise<ParsedTransactionWithMeta[]> {
  try {
    // Fetch the signatures of recent transactions for the program
    const signatures: ConfirmedSignatureInfo[] =
      await connection.getSignaturesForAddress(new PublicKey(programId), {
        limit,
      });

    // Fetch the transaction details for each signature
    const transactions: (ParsedTransactionWithMeta | null)[] =
      await Promise.all(
        signatures.map((sig) =>
          connection
            .getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            })
            .catch((error) => {
              console.error(
                `Error fetching transaction ${sig.signature}:`,
                error,
              );
              return null;
            }),
        ),
      );

    return transactions.filter(
      (tx): tx is ParsedTransactionWithMeta => tx !== null,
    );
  } catch (error) {
    console.error("Error fetching program transactions:", error);
    return [];
  }
}

// Prints full details of the transaction to the console
export async function printTransactionDetails(
  connection: Connection,
  signature: TransactionSignature,
): Promise<void> {
  try {
    const transaction = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      console.log(`Transaction with signature ${signature} not found.`);
      return;
    }

    console.log("Signature:", signature);
    console.log("Slot:", transaction.slot);
    console.log(
      "Block Time:",
      transaction.blockTime
        ? new Date(transaction.blockTime * 1000).toISOString()
        : "N/A",
    );
    console.log("Fee:", transaction.meta?.fee);

    console.log("\nInstructions:");
    transaction.transaction.message.instructions.forEach(
      (instruction, index) => {
        console.log(`Instruction ${index + 1}:`);
        if ("parsed" in instruction) {
          console.log("Program:", instruction.program);
          console.log(
            "Parsed Data:",
            JSON.stringify(instruction.parsed, null, 2),
          );
        } else {
          console.log("Program ID:", instruction.programId.toString());
          console.log("Data (Base58):", instruction.data);
        }
      },
    );

    console.log("\nLog Messages:");
    transaction.meta?.logMessages?.forEach((log, index) => {
      console.log(`${index + 1}. ${log}`);
    });

    console.log("\nToken Balances:");
    transaction.meta?.postTokenBalances?.forEach((balance, index) => {
      console.log(`Account ${index + 1}:`);
      console.log(`  Mint: ${balance.mint}`);
      console.log(`  Owner: ${balance.owner}`);
      console.log(`  Balance: ${balance.uiTokenAmount.uiAmount}`);
    });
  } catch (error) {
    console.error("Error fetching transaction details:", error);
  }
}

// Prints events of the transaction to the console
export async function printTransactionEvents(
  connection: Connection,
  signature: TransactionSignature,
): Promise<void> {
  try {
    const transaction = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      console.log(`Transaction with signature ${signature} not found.`);
      return;
    }

    console.log("Transaction signature:", signature);
    const decodedEvents = decodeEventsFromLogMessages(
      transaction.meta?.logMessages || [],
      IDL,
    );
    //   console.log(decodedEvents);

    if (decodedEvents) {
      console.log("\nEvents:");
      decodedEvents.forEach((event, index) => {
        console.log(`${index + 1}. Event: ${event.name}`);
        console.log("Data:", JSON.stringify(event.data, null, 2));
      });
    } else {
      console.log("Events not found.");
    }
  } catch (error) {
    console.error("Error printing transaction events:", error);
  }
}

// Decodes events from log messages using IDL
export function decodeEventsFromLogMessages(
  logMessages: string[],
  idl: any,
): any[] {
  const coder = new BorshCoder(idl);
  const decodedEvents: any[] = [];

  for (const log of logMessages) {
    if (log.startsWith("Program data: ")) {
      try {
        // Remove the "Program data: " prefix
        const base64Data = log.slice("Program data: ".length);

        const decoded = coder.events.decode(base64Data);
        if (decoded) {
          decodedEvents.push(decoded);
        }
      } catch (error) {
        console.error("Error decoding log:", error);
      }
    }
  }

  return decodedEvents;
}
