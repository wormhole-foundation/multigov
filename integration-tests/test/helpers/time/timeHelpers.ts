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

export const mineToTimestamp = async ({
  client,
  timestamp,
}: { client: Client; timestamp: bigint }) => {
  await client.setNextBlockTimestamp({ timestamp });
  await client.mine({ blocks: 1 });
  await syncTime();
};
