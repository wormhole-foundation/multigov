export default [
  {
    type: 'function',
    name: 'messageFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'parseAndVerifyVM',
    inputs: [
      {
        name: 'encodedVM',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'vm',
        type: 'tuple',
        internalType: 'struct IWormhole.VM',
        components: [
          { name: 'version', type: 'uint8' },
          { name: 'timestamp', type: 'uint32' },
          { name: 'nonce', type: 'uint32' },
          { name: 'emitterChainId', type: 'uint16' },
          { name: 'emitterAddress', type: 'bytes32' },
          { name: 'sequence', type: 'uint64' },
          { name: 'consistencyLevel', type: 'uint8' },
          { name: 'payload', type: 'bytes' },
          { name: 'guardianSetIndex', type: 'uint32' },
          { name: 'signatures', type: 'bytes' },
          { name: 'hash', type: 'bytes32' },
        ],
      },
      { name: 'valid', type: 'bool' },
      { name: 'reason', type: 'string' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'publishMessage',
    inputs: [
      { name: 'nonce', type: 'uint32' },
      { name: 'payload', type: 'bytes' },
      { name: 'consistencyLevel', type: 'uint8' },
    ],
    outputs: [{ name: 'sequence', type: 'uint64' }],
    stateMutability: 'payable',
  },
  {
    type: 'event',
    name: 'LogMessagePublished',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'sequence', type: 'uint64', indexed: false },
      { name: 'nonce', type: 'uint32', indexed: false },
      { name: 'payload', type: 'bytes', indexed: false },
      { name: 'consistencyLevel', type: 'uint8', indexed: false },
    ],
    anonymous: false,
  },
] as const;
