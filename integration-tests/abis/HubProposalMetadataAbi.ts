export default [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_governor',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'GOVERNOR',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IGovernor',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getProposalMetadata',
    inputs: [
      {
        name: '_proposalId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
] as const;
