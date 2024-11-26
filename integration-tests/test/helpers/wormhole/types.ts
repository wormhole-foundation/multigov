export type QueryRes = {
  signatures: string[];
  bytes: string;
};

export type WormholeQueryResponse = {
  queryResponseBytes: `0x${string}`;
  queryResponseSignatures: {
    r: `0x${string}`;
    s: `0x${string}`;
    v: number;
    guardianIndex: number;
  }[];
};
