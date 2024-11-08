import type { Client } from 'test/config/types';
import { createClients } from '../../config/clients';

export const syncTime = async () => {
  console.log('\n⏱️  Synchronizing time between chains...');
  const { ethClient, eth2Client } = createClients();
  const hubTimestamp = (await ethClient.getBlock()).timestamp;
  const spokeTimestamp = (await eth2Client.getBlock()).timestamp;
  const newTimestamp =
    hubTimestamp > spokeTimestamp ? hubTimestamp : spokeTimestamp;
  const timestampToUse = newTimestamp + 1n;

  await ethClient.setNextBlockTimestamp({ timestamp: timestampToUse });
  await eth2Client.setNextBlockTimestamp({ timestamp: timestampToUse });
  await ethClient.mine({ blocks: 1 });
  await eth2Client.mine({ blocks: 1 });

  console.log(
    `✅ Time synchronized: ${timestampToUse} (hub: ${hubTimestamp}, spoke: ${spokeTimestamp})`,
  );
};

export const syncBlocks = async () => {
  const { ethClient, eth2Client } = createClients();
  // 1. Ensure both chains are at the same block height
  const hubBlock = await ethClient.getBlockNumber();
  const spokeBlock = await eth2Client.getBlockNumber();
  const targetBlock = Math.max(Number(hubBlock), Number(spokeBlock));
  if (hubBlock < targetBlock) {
    console.log(
      `   Mining ${targetBlock - Number(hubBlock)} blocks on hub chain`,
    );
    await ethClient.mine({ blocks: targetBlock - Number(hubBlock) });
  }
  if (spokeBlock < targetBlock) {
    console.log(
      `   Mining ${targetBlock - Number(spokeBlock)} blocks on spoke chain`,
    );
    await eth2Client.mine({ blocks: targetBlock - Number(spokeBlock) });
  }
  console.log('✅ Chains synchronized');
};

export const mineToTimestamp = async ({
  client,
  timestamp,
}: { client: Client; timestamp: bigint }) => {
  console.log(`   Mining to timestamp ${timestamp}...`);
  await client.setNextBlockTimestamp({ timestamp });
  await client.mine({ blocks: 1 });
  console.log('✅ Mined to timestamp');
  await syncTime();
};
