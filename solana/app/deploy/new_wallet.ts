import { Keypair } from '@solana/web3.js';
import fs from 'fs';

// Generate a new Keypair
const newWallet = Keypair.generate();

// Extract public and private keys
const publicKey = newWallet.publicKey.toString();
const secretKey = Buffer.from(newWallet.secretKey).toString('base64'); // keep it secure

console.log('Public Key:', publicKey);
console.log('Secret Key (base64):', secretKey);

// Save the secret key to a file
fs.writeFileSync('app/deploy/user3.json', JSON.stringify([...newWallet.secretKey]));
console.log('Wallet saved to app/deploy/user3.json');
