import {
  Connection,
  PublicKey,
  ConfirmedSignatureInfo,
  ParsedTransactionWithMeta,
} from '@solana/web3.js';

import { RPC_NODE } from "./devnet";

async function getProgramTransactions(
  programId: string,
  limit: number = 10
): Promise<ParsedTransactionWithMeta[]> {
  const connection = new Connection(RPC_NODE, 'confirmed');

  const pubKey = new PublicKey(programId);

  try {
    // Fetch the signatures of recent transactions for the program
    const signatures: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(
      pubKey,
      { limit }
    );

    // Fetch the transaction details for each signature
    const transactions: (ParsedTransactionWithMeta | null)[] = await Promise.all(
      signatures.map((sig) => 
        connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0
        }).catch(error => {
          console.error(`Error fetching transaction ${sig.signature}:`, error);
          return null;
        })
      )
    );

    return transactions.filter((tx): tx is ParsedTransactionWithMeta => tx !== null);
  } catch (error) {
    console.error('Error fetching program transactions:', error);
    return [];
  }
}

async function main() {
  const programId = '5Vry3MrbhPCBWuviXVgcLQzhQ1mRsVfmQyNFuDgcPUAQ';
  const limit = 5;

  getProgramTransactions(programId, limit)
    .then((transactions) => {
      console.log(`Found ${transactions.length} transactions for program ${programId}:`);
      transactions.forEach((tx, index) => {
        console.log(`Transaction ${index + 1}:`);
        console.log('  Signature:', tx.transaction.signatures[0]);
        console.log('  Slot:', tx.slot);
        console.log('  Block Time:', tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'N/A');
        console.log('  Fee:', tx.meta?.fee);
        console.log('---');
      });
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

main();

