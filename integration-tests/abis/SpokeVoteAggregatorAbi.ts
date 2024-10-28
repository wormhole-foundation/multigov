export default [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_spokeMetadataCollector',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_votingToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_initialVoteWindow',
        type: 'uint48',
        internalType: 'uint48',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'BALLOT_TYPEHASH',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'COUNTING_MODE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
        internalType: 'string',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'VOTING_TOKEN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract ERC20Votes',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'castVote',
    inputs: [
      {
        name: '_proposalId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_support',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'castVoteBySig',
    inputs: [
      {
        name: '_proposalId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_support',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: '_voter',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'castVoteWithReason',
    inputs: [
      {
        name: '_proposalId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_support',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: '_reason',
        type: 'string',
        internalType: 'string',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'castVoteWithReasonAndParams',
    inputs: [
      {
        name: '_proposalId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_support',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: '_reason',
        type: 'string',
        internalType: 'string',
      },
      {
        name: '_params',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'eip712Domain',
    inputs: [],
    outputs: [
      {
        name: 'fields',
        type: 'bytes1',
        internalType: 'bytes1',
      },
      {
        name: 'name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'version',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'chainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'verifyingContract',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'extensions',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVoteWeightWindowLength',
    inputs: [
      {
        name: '_timepoint',
        type: 'uint96',
        internalType: 'uint96',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint48',
        internalType: 'uint48',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVotes',
    inputs: [
      {
        name: '_account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_timepoint',
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
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasVoted',
    inputs: [
      {
        name: 'proposalId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
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
    name: 'proposalVotes',
    inputs: [
      {
        name: '_proposalId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'proposalId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'againstVotes',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'forVotes',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'abstainVotes',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'renounceOwnership',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setSpokeMetadataCollector',
    inputs: [
      {
        name: '_newSpokeMetadataCollector',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setVoteWeightWindow',
    inputs: [
      {
        name: '_voteWeightWindow',
        type: 'uint48',
        internalType: 'uint48',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'spokeMetadataCollector',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract SpokeMetadataCollector',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'token',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IERC5805',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transferOwnership',
    inputs: [
      {
        name: 'newOwner',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'voteActiveInternal',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'voteWeightCast',
    inputs: [
      {
        name: 'proposalId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint128',
        internalType: 'uint128',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'EIP712DomainChanged',
    inputs: [],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OwnershipTransferred',
    inputs: [
      {
        name: 'previousOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'newOwner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SpokeMetadataCollectorUpdated',
    inputs: [
      {
        name: 'oldSpokeMetadata',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'newSpokeMetadata',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      {
        name: 'voter',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'proposalId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'support',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'weight',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'reason',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VoteCastWithParams',
    inputs: [
      {
        name: 'voter',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'proposalId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'support',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'weight',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'reason',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
      {
        name: 'params',
        type: 'bytes',
        indexed: false,
        internalType: 'bytes',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VoteWeightWindowUpdated',
    inputs: [
      {
        name: 'oldVoteWeightWindow',
        type: 'uint48',
        indexed: false,
        internalType: 'uint48',
      },
      {
        name: 'newVoteWeightWindow',
        type: 'uint48',
        indexed: false,
        internalType: 'uint48',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'CheckpointUnorderedInsertion',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAccountNonce',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'currentNonce',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidShortString',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSignature',
    inputs: [
      {
        name: 'voter',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidVoteType',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoWeight',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'OwnerIsZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OwnerUnauthorizedAccount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'ProposalInactive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeCastOverflowedUintDowncast',
    inputs: [
      {
        name: 'bits',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StringTooLong',
    inputs: [
      {
        name: 'str',
        type: 'string',
        internalType: 'string',
      },
    ],
  },
] as const;
