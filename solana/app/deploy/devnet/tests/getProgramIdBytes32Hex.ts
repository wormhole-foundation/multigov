// Usage: npx ts-node app/deploy/devnet/tests/getProgramIdBytes32Hex.ts
// AFuHPdrQGsW8rNQ4oEFF35sm5fg36gwrxyqjkjKvi6ap

import { PublicKey } from "@solana/web3.js";
import input from "@inquirer/input";

async function main() {
  try {
    const programId = await input({ message: "Enter the program id:" });
    const programIdPublicKey = new PublicKey(programId);
    console.log('Program ID:', "0x" + Buffer.from(programIdPublicKey.toBytes()).toString('hex'))
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
