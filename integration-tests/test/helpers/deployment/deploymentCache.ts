import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Address } from 'viem';
import type { DeployedAddresses } from '../../config/addresses';

const CACHE_FILE = join(process.cwd(), '.deployment-cache.json');

type DeploymentCache = {
  timestamp: number;
  addresses: Partial<Record<keyof DeployedAddresses, Address>>;
};

export const saveDeploymentCache = (
  addresses: Partial<Record<keyof DeployedAddresses, Address>>,
) => {
  const cache: DeploymentCache = {
    timestamp: Date.now(),
    addresses,
  };

  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log('💾 Deployment cache saved');
};

export const loadDeploymentCache = (): Partial<
  Record<keyof DeployedAddresses, Address>
> | null => {
  try {
    if (!existsSync(CACHE_FILE)) {
      return null;
    }

    const cache: DeploymentCache = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));

    // Optional: Check if cache is too old
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (Date.now() - cache.timestamp > ONE_DAY) {
      console.log('⚠️  Deployment cache is older than 24 hours');
      return null;
    }

    console.log('📂 Using cached deployment');
    return cache.addresses;
  } catch (error) {
    console.log('⚠️  Error loading deployment cache:', error);
    return null;
  }
};
