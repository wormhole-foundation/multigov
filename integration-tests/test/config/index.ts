// Use Kubernetes service names in CI, localhost for local dev
const BASE_URL = process.env.CI ? 'http://query-server' : 'http://localhost';

export { account } from './mainAccount';
export { ethDevnet, eth2Devnet } from './chains';

export const SERVER_URL = `${BASE_URL}:`;
export const CCQ_SERVER_URL = `${SERVER_URL}6069/v1`;
export const QUERY_URL = `${CCQ_SERVER_URL}/query`;
