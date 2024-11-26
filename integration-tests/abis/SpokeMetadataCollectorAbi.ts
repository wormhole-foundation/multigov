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
        name: '_hubChainId',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: '_hubProposalMetadata',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'HUB_CHAIN_ID',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint16',
        internalType: 'uint16',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'HUB_PROPOSAL_METADATA',
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
    name: 'addProposal',
    inputs: [
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
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getProposal',
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
        type: 'tuple',
        internalType: 'struct SpokeMetadataCollector.Proposal',
        components: [
          {
            name: 'voteStart',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
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
    name: 'ProposalCreated',
    inputs: [
      {
        name: 'proposalId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'start',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
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
    name: 'InvalidQueryBlock',
    inputs: [
      {
        name: 'blockId',
        type: 'bytes',
        internalType: 'bytes',
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
    name: 'ProposalAlreadyExists',
    inputs: [
      {
        name: 'proposalId',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'TooManyParsedQueryResponses',
    inputs: [
      {
        name: 'numResults',
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
