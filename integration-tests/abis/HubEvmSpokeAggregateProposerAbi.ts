export default [
  {
    type: 'constructor',
    inputs: [
      {
        name: '_core',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_hubGovernor',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_initialMaxQueryTimestampOffset',
        type: 'uint48',
        internalType: 'uint48',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'HUB_GOVERNOR',
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
    name: 'QT_ETH_CALL',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'QT_ETH_CALL_BY_TIMESTAMP',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'QT_ETH_CALL_WITH_FINALITY',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'QT_MAX',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'QT_SOL_ACCOUNT',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'QT_SOL_PDA',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'VERSION',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cancel',
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
      {
        name: '_descriptionHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'checkAndProposeIfEligible',
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
      {
        name: '_description',
        type: 'string',
        internalType: 'string',
      },
      {
        name: '_queryResponseRaw',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: '_signatures',
        type: 'tuple[]',
        internalType: 'struct IWormhole.Signature[]',
        components: [
          {
            name: 'r',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 's',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'v',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'guardianIndex',
            type: 'uint8',
            internalType: 'uint8',
          },
        ],
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
    name: 'getResponseDigest',
    inputs: [
      {
        name: 'response',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'getResponseHash',
    inputs: [
      {
        name: 'response',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'maxQueryTimestampOffset',
    inputs: [],
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
    name: 'parseAndVerifyQueryResponse',
    inputs: [
      {
        name: 'response',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'signatures',
        type: 'tuple[]',
        internalType: 'struct IWormhole.Signature[]',
        components: [
          {
            name: 'r',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 's',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'v',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'guardianIndex',
            type: 'uint8',
            internalType: 'uint8',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'r',
        type: 'tuple',
        internalType: 'struct ParsedQueryResponse',
        components: [
          {
            name: 'version',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'senderChainId',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'nonce',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'requestId',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'responses',
            type: 'tuple[]',
            internalType: 'struct ParsedPerChainQueryResponse[]',
            components: [
              {
                name: 'chainId',
                type: 'uint16',
                internalType: 'uint16',
              },
              {
                name: 'queryType',
                type: 'uint8',
                internalType: 'uint8',
              },
              {
                name: 'request',
                type: 'bytes',
                internalType: 'bytes',
              },
              {
                name: 'response',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'parseEthCallByTimestampQueryResponse',
    inputs: [
      {
        name: 'pcr',
        type: 'tuple',
        internalType: 'struct ParsedPerChainQueryResponse',
        components: [
          {
            name: 'chainId',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'queryType',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'request',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'response',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'r',
        type: 'tuple',
        internalType: 'struct EthCallByTimestampQueryResponse',
        components: [
          {
            name: 'requestTargetBlockIdHint',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'requestFollowingBlockIdHint',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'requestTargetTimestamp',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'targetBlockNum',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'targetBlockTime',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'followingBlockNum',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'targetBlockHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'followingBlockHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'followingBlockTime',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'result',
            type: 'tuple[]',
            internalType: 'struct EthCallData[]',
            components: [
              {
                name: 'contractAddress',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'callData',
                type: 'bytes',
                internalType: 'bytes',
              },
              {
                name: 'result',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'parseEthCallQueryResponse',
    inputs: [
      {
        name: 'pcr',
        type: 'tuple',
        internalType: 'struct ParsedPerChainQueryResponse',
        components: [
          {
            name: 'chainId',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'queryType',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'request',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'response',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'r',
        type: 'tuple',
        internalType: 'struct EthCallQueryResponse',
        components: [
          {
            name: 'requestBlockId',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'blockNum',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'blockTime',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'blockHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'result',
            type: 'tuple[]',
            internalType: 'struct EthCallData[]',
            components: [
              {
                name: 'contractAddress',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'callData',
                type: 'bytes',
                internalType: 'bytes',
              },
              {
                name: 'result',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'parseEthCallWithFinalityQueryResponse',
    inputs: [
      {
        name: 'pcr',
        type: 'tuple',
        internalType: 'struct ParsedPerChainQueryResponse',
        components: [
          {
            name: 'chainId',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'queryType',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'request',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'response',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'r',
        type: 'tuple',
        internalType: 'struct EthCallWithFinalityQueryResponse',
        components: [
          {
            name: 'requestBlockId',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'requestFinality',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'blockNum',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'blockTime',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'blockHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'result',
            type: 'tuple[]',
            internalType: 'struct EthCallData[]',
            components: [
              {
                name: 'contractAddress',
                type: 'address',
                internalType: 'address',
              },
              {
                name: 'callData',
                type: 'bytes',
                internalType: 'bytes',
              },
              {
                name: 'result',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'parseSolanaAccountQueryResponse',
    inputs: [
      {
        name: 'pcr',
        type: 'tuple',
        internalType: 'struct ParsedPerChainQueryResponse',
        components: [
          {
            name: 'chainId',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'queryType',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'request',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'response',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'r',
        type: 'tuple',
        internalType: 'struct SolanaAccountQueryResponse',
        components: [
          {
            name: 'requestCommitment',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'requestMinContextSlot',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'requestDataSliceOffset',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'requestDataSliceLength',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'slotNumber',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'blockTime',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'blockHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'results',
            type: 'tuple[]',
            internalType: 'struct SolanaAccountResult[]',
            components: [
              {
                name: 'account',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'lamports',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'rentEpoch',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'executable',
                type: 'bool',
                internalType: 'bool',
              },
              {
                name: 'owner',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'data',
                type: 'bytes',
                internalType: 'bytes',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'parseSolanaPdaQueryResponse',
    inputs: [
      {
        name: 'pcr',
        type: 'tuple',
        internalType: 'struct ParsedPerChainQueryResponse',
        components: [
          {
            name: 'chainId',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'queryType',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'request',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'response',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'r',
        type: 'tuple',
        internalType: 'struct SolanaPdaQueryResponse',
        components: [
          {
            name: 'requestCommitment',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'requestMinContextSlot',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'requestDataSliceOffset',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'requestDataSliceLength',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'slotNumber',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'blockTime',
            type: 'uint64',
            internalType: 'uint64',
          },
          {
            name: 'blockHash',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'results',
            type: 'tuple[]',
            internalType: 'struct SolanaPdaResult[]',
            components: [
              {
                name: 'programId',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'seeds',
                type: 'bytes[]',
                internalType: 'bytes[]',
              },
              {
                name: 'account',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'lamports',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'rentEpoch',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'executable',
                type: 'bool',
                internalType: 'bool',
              },
              {
                name: 'owner',
                type: 'bytes32',
                internalType: 'bytes32',
              },
              {
                name: 'data',
                type: 'bytes',
                internalType: 'bytes',
              },
              {
                name: 'bump',
                type: 'uint8',
                internalType: 'uint8',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'proposalCreators',
    inputs: [
      {
        name: 'proposalId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'creator',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registerSpoke',
    inputs: [
      {
        name: '_chainId',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: '_spokeVoteAggregator',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'registeredSpokes',
    inputs: [
      {
        name: 'wormholeChainId',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    outputs: [
      {
        name: 'spokeVoteAggregator',
        type: 'address',
        internalType: 'address',
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
    name: 'responsePrefix',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setMaxQueryTimestampOffset',
    inputs: [
      {
        name: '_newMaxQueryTimestampOffset',
        type: 'uint48',
        internalType: 'uint48',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
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
    name: 'validateBlockNum',
    inputs: [
      {
        name: '_blockNum',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: '_minBlockNum',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'validateBlockTime',
    inputs: [
      {
        name: '_blockTime',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: '_minBlockTime',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'validateChainId',
    inputs: [
      {
        name: 'chainId',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: '_validChainIds',
        type: 'uint16[]',
        internalType: 'uint16[]',
      },
    ],
    outputs: [],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'validateEthCallData',
    inputs: [
      {
        name: 'r',
        type: 'tuple',
        internalType: 'struct EthCallData',
        components: [
          {
            name: 'contractAddress',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'callData',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'result',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: '_expectedContractAddresses',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: '_expectedFunctionSignatures',
        type: 'bytes4[]',
        internalType: 'bytes4[]',
      },
    ],
    outputs: [],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'validateMultipleEthCallData',
    inputs: [
      {
        name: 'r',
        type: 'tuple[]',
        internalType: 'struct EthCallData[]',
        components: [
          {
            name: 'contractAddress',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'callData',
            type: 'bytes',
            internalType: 'bytes',
          },
          {
            name: 'result',
            type: 'bytes',
            internalType: 'bytes',
          },
        ],
      },
      {
        name: '_expectedContractAddresses',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: '_expectedFunctionSignatures',
        type: 'bytes4[]',
        internalType: 'bytes4[]',
      },
    ],
    outputs: [],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'verifyQueryResponseSignatures',
    inputs: [
      {
        name: 'response',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'signatures',
        type: 'tuple[]',
        internalType: 'struct IWormhole.Signature[]',
        components: [
          {
            name: 'r',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 's',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'v',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'guardianIndex',
            type: 'uint8',
            internalType: 'uint8',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'wormhole',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IWormhole',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'MaxQueryTimestampOffsetUpdated',
    inputs: [
      {
        name: 'oldMaxQueryTimestampOffset',
        type: 'uint48',
        indexed: false,
        internalType: 'uint48',
      },
      {
        name: 'newMaxQueryTimestampOffset',
        type: 'uint48',
        indexed: false,
        internalType: 'uint48',
      },
    ],
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
    name: 'SpokeRegistered',
    inputs: [
      {
        name: 'chainId',
        type: 'uint16',
        indexed: true,
        internalType: 'uint16',
      },
      {
        name: 'oldSpokeAddress',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'newSpokeAddress',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'ChainIdMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmptyWormholeAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InsufficientVoteWeight',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidBoolVal',
    inputs: [
      {
        name: 'val',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidCallDataLength',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidCaller',
    inputs: [
      {
        name: 'expected',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'actual',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidChainId',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidContractAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidFunctionSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidOffset',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidPayloadLength',
    inputs: [
      {
        name: 'received',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidResponseVersion',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTimestamp',
    inputs: [
      {
        name: 'invalidTimestamp',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
  },
  {
    type: 'error',
    name: 'LengthMismatch',
    inputs: [
      {
        name: 'encodedLength',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expectedLength',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'NumberOfResponsesMismatch',
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
    name: 'RequestTypeMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StaleBlockNum',
    inputs: [],
  },
  {
    type: 'error',
    name: 'StaleBlockTime',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TooManyEthCallResults',
    inputs: [
      {
        name: 'numCalls',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'UnexpectedNumberOfResults',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnregisteredSpoke',
    inputs: [
      {
        name: 'chainId',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'spokeAddress',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'UnsupportedQueryType',
    inputs: [
      {
        name: 'received',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'VersionMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'WrongQueryType',
    inputs: [
      {
        name: 'received',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'expected',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
  },
  {
    type: 'error',
    name: 'ZeroQueries',
    inputs: [],
  },
] as const;
