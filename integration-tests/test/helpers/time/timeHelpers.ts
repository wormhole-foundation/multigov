import type { Client } from 'test/config/types';
import { createClients } from '../../config/clients';

export const syncTime = async () => {
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
  await client.setNextBlockTimestamp({ timestamp });
  await client.mine({ blocks: 1 });
  await syncTime();
};
