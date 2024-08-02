import { Connection } from '@solana/web3.js';
import { RPC_NODE } from "./devnet";
import { decodeEventsFromLogMessages } from "../utils/parse_transactions";
import IDL from '../../target/idl/staking.json';

async function main() {
  const connection = new Connection(RPC_NODE, 'confirmed');

  const transactionSignature = '3er1rCAdfVkKjmyURX4HJJxqFsY4EjnCdyC3M4NCqMb4RErKh7USgacYQAsb42W6Syf9Dx1hn4kk3wzSPQrcGpsw';

  const transaction = await connection.getParsedTransaction(transactionSignature, {
    maxSupportedTransactionVersion: 0
  });

  if (!transaction) {
    console.log(`Transaction with signature ${transactionSignature} not found.`);
    return;
  }

  console.log('Transaction signature:', transactionSignature);
  const decodedEvents = decodeEventsFromLogMessages(
    connection,
    transaction.meta?.logMessages || [],
    IDL
  );
//   console.log(decodedEvents);

  if (decodedEvents) {
    console.log('\nEvents:');
    decodedEvents.forEach((event, index) => {
      console.log(`${index + 1}. Event: ${event.name}`);
      console.log('Data:', JSON.stringify(event.data, null, 2));
    });
  } else {
    console.log('Events not found.');
  }
}

main();


