export default [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_messageExecutor',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'receive',
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'MESSAGE_EXECUTOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'executeOperations',
    inputs: [
      {
        name: '_targets',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: '_values',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
      {
        name: '_calldatas',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'performDelegateCall',
    inputs: [
      {
        name: '_target',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_calldata',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'event',
    name: 'MessageExecutorUpdated',
    inputs: [
      {
        name: 'newMessageExecutor',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AddressEmptyCode',
    inputs: [
      {
        name: 'target',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'FailedInnerCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidCaller',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidMessageExecutor',
    inputs: [],
  },
] as const;
