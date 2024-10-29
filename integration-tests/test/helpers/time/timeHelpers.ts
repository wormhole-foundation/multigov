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

  await mineToTimestamp({
    client: ethClient,
    timestamp: timestampToUse,
  });

  await mineToTimestamp({
    client: eth2Client,
    timestamp: timestampToUse,
  });

  console.log(
    `✅ Time synchronized: ${timestampToUse} (hub: ${hubTimestamp}, spoke: ${spokeTimestamp})`,
  );
};

export const mineToTimestamp = async ({
  client,
  timestamp,
}: { client: Client; timestamp: bigint }) => {
  console.log(`   Mining to timestamp ${timestamp}...`);
  await client.setNextBlockTimestamp({ timestamp });
  await client.mine({ blocks: 1 });
  console.log('✅ Mined to timestamp');
};

export const mineToTimestamp = async ({
  client,
  timestamp,
}: { client: Client; timestamp: bigint }) => {
  await client.setNextBlockTimestamp({ timestamp });
  await client.mine({ blocks: 1 });
  await syncTime();
};
