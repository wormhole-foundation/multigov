export type Staking = {
  "version": "1.2.0",
  "name": "staking",
  "instructions": [
    {
      "name": "initConfig",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "configAccount",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "globalConfig",
          "type": {
            "defined": "GlobalConfig"
          }
        }
      ]
    },
    {
      "name": "updateGovernanceAuthority",
      "accounts": [
        {
          "name": "governanceSigner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "updatePdaAuthority",
      "accounts": [
        {
          "name": "governanceSigner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "updateAgreementHash",
      "accounts": [
        {
          "name": "governanceSigner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "agreementHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createStakeAccount",
      "docs": [
        "Trustless instruction that creates a stake account for a user"
      ],
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stakeAccountCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "custodyAuthority",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK : This AccountInfo is safe because it's a checked PDA"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "authority"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "voterWeightRecord",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "voter_weight_record"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakeAccountCustody",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "custody"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "owner",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "delegate",
      "accounts": [
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "stakeAccountCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "custodyAuthority",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK : This AccountInfo is safe because it's a checked PDA"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "authority"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "stakeAccountCustody",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "custody"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "currentDelegateStakeAccountCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "currentDelegateStakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "current_delegate_stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "delegateeStakeAccountCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "delegateeStakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "delegatee_stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "delegatee",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "withdrawTokens",
      "accounts": [
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "destination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeAccountCheckpoints",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakeAccountMetadata",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "stakeAccountCustody",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "custody"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "custodyAuthority",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK : This AccountInfo is safe because it's a checked PDA"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "authority"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addProposal",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "proposal"
              },
              {
                "kind": "arg",
                "type": "u64",
                "path": "proposal_id"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "proposalId",
          "type": "u64"
        },
        {
          "name": "voteStart",
          "type": "u64"
        },
        {
          "name": "safeWindow",
          "type": "u64"
        }
      ]
    },
    {
      "name": "castVote",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "proposal"
              },
              {
                "kind": "arg",
                "type": "u64",
                "path": "proposal_id"
              }
            ]
          }
        },
        {
          "name": "voterCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalVotersWeightCast",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "proposal_voters_weight_cast"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "account": "ProposalData",
                "path": "proposal"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "voter_checkpoints"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "proposalId",
          "type": "u64"
        },
        {
          "name": "againstVotes",
          "type": "u64"
        },
        {
          "name": "forVotes",
          "type": "u64"
        },
        {
          "name": "abstainVotes",
          "type": "u64"
        }
      ]
    },
    {
      "name": "joinDaoLlc",
      "docs": [
        "* Accept to join the DAO LLC\n     * This must happen before delegate\n     * The user signs a hash of the agreement and the program checks that the hash matches the\n     * agreement"
      ],
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stakeAccountCheckpoints",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "agreementHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "recoverAccount",
      "docs": [
        "Recovers a user's `stake account` ownership by transferring ownership\n     * from a token account to the `owner` of that token account.\n     *\n     * This functionality addresses the scenario where a user mistakenly\n     * created a stake account using their token account address as the owner."
      ],
      "accounts": [
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "payerTokenAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakeAccountCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "voterWeightRecord",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "voter_weight_record"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "checkpointData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "nextIndex",
            "type": "u64"
          },
          {
            "name": "checkpoints",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    48
                  ]
                },
                210
              ]
            }
          }
        ]
      }
    },
    {
      "name": "globalConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "governanceAuthority",
            "type": "publicKey"
          },
          {
            "name": "whTokenMint",
            "type": "publicKey"
          },
          {
            "name": "whGovernanceRealm",
            "type": "publicKey"
          },
          {
            "name": "epochDuration",
            "type": "u64"
          },
          {
            "name": "freeze",
            "type": "bool"
          },
          {
            "name": "pdaAuthority",
            "type": "publicKey"
          },
          {
            "name": "governanceProgram",
            "type": "publicKey"
          },
          {
            "name": "agreementHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "mockClockTime",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "proposalVotersWeightCast",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalId",
            "type": "u64"
          },
          {
            "name": "voter",
            "type": "publicKey"
          },
          {
            "name": "value",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "proposalData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "againstVotes",
            "type": "u64"
          },
          {
            "name": "forVotes",
            "type": "u64"
          },
          {
            "name": "abstainVotes",
            "type": "u64"
          },
          {
            "name": "voteStart",
            "type": "u64"
          },
          {
            "name": "safeWindow",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "stakeAccountMetadata",
      "docs": [
        "This is the metadata account for each staker",
        "It is derived from the checkpoints account with seeds \"stake_metadata\"",
        "and the checkpoints account pubkey",
        "It stores some PDA bumps, owner and delegate accounts"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "metadataBump",
            "type": "u8"
          },
          {
            "name": "custodyBump",
            "type": "u8"
          },
          {
            "name": "authorityBump",
            "type": "u8"
          },
          {
            "name": "voterBump",
            "type": "u8"
          },
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "delegate",
            "type": "publicKey"
          },
          {
            "name": "recordedBalance",
            "type": "u64"
          },
          {
            "name": "transferEpoch",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "signedAgreementHash",
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "voterWeightRecord",
      "docs": [
        "VoterWeightRecord account"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "realm",
            "docs": [
              "The Realm the VoterWeightRecord belongs to"
            ],
            "type": "publicKey"
          },
          {
            "name": "governingTokenMint",
            "docs": [
              "Governing Token Mint the VoterWeightRecord is associated with"
            ],
            "type": "publicKey"
          },
          {
            "name": "governingTokenOwner",
            "docs": [
              "The owner of the governing token and voter",
              "This is the actual owner (voter) and corresponds to",
              "TokenOwnerRecord.governing_token_owner"
            ],
            "type": "publicKey"
          },
          {
            "name": "voterWeight",
            "docs": [
              "Voter's weight"
            ],
            "type": "u64"
          },
          {
            "name": "weightAction",
            "docs": [
              "The governance action the voter's weight pertains to",
              "It allows to provided voter's weight specific to the particular action",
              "the weight is evaluated for."
            ],
            "type": {
              "option": {
                "defined": "VoterWeightAction"
              }
            }
          },
          {
            "name": "weightActionTarget",
            "docs": [
              "The target the voter's weight  action pertains to",
              "It allows to provided voter's weight specific to the target the weight",
              "is evaluated for. For example when addin supplies weight to vote on a",
              "particular proposal then it must specify the proposal as the action",
              "target."
            ],
            "type": {
              "option": "publicKey"
            }
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved space for future versions"
            ],
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Checkpoint",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "value",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "VoterWeightAction",
      "docs": [
        "The governance action VoterWeight is evaluated for"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "CastVote"
          },
          {
            "name": "CreateGovernance"
          },
          {
            "name": "CreateProposal"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "DelegateVotesChanged",
      "fields": [
        {
          "name": "delegate",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "previousBalance",
          "type": "u64",
          "index": false
        },
        {
          "name": "newBalance",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "DelegateChanged",
      "fields": [
        {
          "name": "delegator",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "fromDelegate",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "toDelegate",
          "type": "publicKey",
          "index": false
        }
      ]
    },
    {
      "name": "VoteCast",
      "fields": [
        {
          "name": "voter",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "proposalId",
          "type": "u64",
          "index": false
        },
        {
          "name": "weight",
          "type": "u64",
          "index": false
        },
        {
          "name": "againstVotes",
          "type": "u64",
          "index": false
        },
        {
          "name": "forVotes",
          "type": "u64",
          "index": false
        },
        {
          "name": "abstainVotes",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "ProposalCreated",
      "fields": [
        {
          "name": "proposalId",
          "type": "u64",
          "index": false
        },
        {
          "name": "voteStart",
          "type": "u64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "TooManyCheckpoints",
      "msg": "Number of checkpoint limit reached"
    },
    {
      "code": 6001,
      "name": "ZeroEpochDuration",
      "msg": "Epoch duration is 0"
    },
    {
      "code": 6002,
      "name": "GenericOverflow",
      "msg": "An arithmetic operation unexpectedly overflowed"
    },
    {
      "code": 6003,
      "name": "CheckpointSerDe",
      "msg": "Error deserializing checkpoint"
    },
    {
      "code": 6004,
      "name": "CheckpointOutOfBounds",
      "msg": "Checkpoint out of bounds"
    },
    {
      "code": 6005,
      "name": "NotLlcMember",
      "msg": "You need to be an LLC member to perform this action"
    },
    {
      "code": 6006,
      "name": "RecoverWithStake",
      "msg": "Can't recover account with a non-zero staking balance. Unstake your tokens first."
    },
    {
      "code": 6007,
      "name": "CheckpointNotFound",
      "msg": "Checkpoint not found"
    },
    {
      "code": 6008,
      "name": "InvalidTimestamp",
      "msg": "Invalid timestamp"
    },
    {
      "code": 6009,
      "name": "InvalidLlcAgreement",
      "msg": "Invalid LLC agreement"
    },
    {
      "code": 6010,
      "name": "NoWeight",
      "msg": "No Weight"
    },
    {
      "code": 6011,
      "name": "AllWeightCast",
      "msg": "All weight cast"
    },
    {
      "code": 6012,
      "name": "VoteWouldExceedWeight",
      "msg": "Vote would exceed weight"
    },
    {
      "code": 6013,
      "name": "WithdrawToUnauthorizedAccount",
      "msg": "Owner needs to own destination account"
    },
    {
      "code": 6014,
      "name": "InsufficientWithdrawableBalance",
      "msg": "Insufficient balance to cover the withdrawal"
    },
    {
      "code": 6015,
      "name": "ProposalAlreadyExists",
      "msg": "Proposal already exists"
    },
    {
      "code": 6016,
      "name": "Other",
      "msg": "Other"
    }
  ]
};

export const IDL: Staking = {
  "version": "1.2.0",
  "name": "staking",
  "instructions": [
    {
      "name": "initConfig",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "configAccount",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "globalConfig",
          "type": {
            "defined": "GlobalConfig"
          }
        }
      ]
    },
    {
      "name": "updateGovernanceAuthority",
      "accounts": [
        {
          "name": "governanceSigner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "updatePdaAuthority",
      "accounts": [
        {
          "name": "governanceSigner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "updateAgreementHash",
      "accounts": [
        {
          "name": "governanceSigner",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "config",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "agreementHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createStakeAccount",
      "docs": [
        "Trustless instruction that creates a stake account for a user"
      ],
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stakeAccountCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "custodyAuthority",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK : This AccountInfo is safe because it's a checked PDA"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "authority"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "voterWeightRecord",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "voter_weight_record"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakeAccountCustody",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "custody"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "rent",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "owner",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "delegate",
      "accounts": [
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "stakeAccountCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "custodyAuthority",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK : This AccountInfo is safe because it's a checked PDA"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "authority"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "stakeAccountCustody",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "custody"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "currentDelegateStakeAccountCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "currentDelegateStakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "current_delegate_stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "delegateeStakeAccountCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "delegateeStakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "delegatee_stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        },
        {
          "name": "mint",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "delegatee",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "withdrawTokens",
      "accounts": [
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "destination",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeAccountCheckpoints",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakeAccountMetadata",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "stakeAccountCustody",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "custody"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "custodyAuthority",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "CHECK : This AccountInfo is safe because it's a checked PDA"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "authority"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "addProposal",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "proposal"
              },
              {
                "kind": "arg",
                "type": "u64",
                "path": "proposal_id"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "proposalId",
          "type": "u64"
        },
        {
          "name": "voteStart",
          "type": "u64"
        },
        {
          "name": "safeWindow",
          "type": "u64"
        }
      ]
    },
    {
      "name": "castVote",
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "proposal",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "proposal"
              },
              {
                "kind": "arg",
                "type": "u64",
                "path": "proposal_id"
              }
            ]
          }
        },
        {
          "name": "voterCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "proposalVotersWeightCast",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "proposal_voters_weight_cast"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "account": "ProposalData",
                "path": "proposal"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "voter_checkpoints"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "proposalId",
          "type": "u64"
        },
        {
          "name": "againstVotes",
          "type": "u64"
        },
        {
          "name": "forVotes",
          "type": "u64"
        },
        {
          "name": "abstainVotes",
          "type": "u64"
        }
      ]
    },
    {
      "name": "joinDaoLlc",
      "docs": [
        "* Accept to join the DAO LLC\n     * This must happen before delegate\n     * The user signs a hash of the agreement and the program checks that the hash matches the\n     * agreement"
      ],
      "accounts": [
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "stakeAccountCheckpoints",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "agreementHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "recoverAccount",
      "docs": [
        "Recovers a user's `stake account` ownership by transferring ownership\n     * from a token account to the `owner` of that token account.\n     *\n     * This functionality addresses the scenario where a user mistakenly\n     * created a stake account using their token account address as the owner."
      ],
      "accounts": [
        {
          "name": "payer",
          "isMut": false,
          "isSigner": true
        },
        {
          "name": "payerTokenAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "stakeAccountCheckpoints",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "voterWeightRecord",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "voter_weight_record"
              },
              {
                "kind": "account",
                "type": "publicKey",
                "path": "stake_account_checkpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "isMut": false,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "config"
              }
            ]
          }
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "checkpointData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "nextIndex",
            "type": "u64"
          },
          {
            "name": "checkpoints",
            "type": {
              "array": [
                {
                  "array": [
                    "u8",
                    48
                  ]
                },
                210
              ]
            }
          }
        ]
      }
    },
    {
      "name": "globalConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "governanceAuthority",
            "type": "publicKey"
          },
          {
            "name": "whTokenMint",
            "type": "publicKey"
          },
          {
            "name": "whGovernanceRealm",
            "type": "publicKey"
          },
          {
            "name": "epochDuration",
            "type": "u64"
          },
          {
            "name": "freeze",
            "type": "bool"
          },
          {
            "name": "pdaAuthority",
            "type": "publicKey"
          },
          {
            "name": "governanceProgram",
            "type": "publicKey"
          },
          {
            "name": "agreementHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "mockClockTime",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "proposalVotersWeightCast",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalId",
            "type": "u64"
          },
          {
            "name": "voter",
            "type": "publicKey"
          },
          {
            "name": "value",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "proposalData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "againstVotes",
            "type": "u64"
          },
          {
            "name": "forVotes",
            "type": "u64"
          },
          {
            "name": "abstainVotes",
            "type": "u64"
          },
          {
            "name": "voteStart",
            "type": "u64"
          },
          {
            "name": "safeWindow",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "stakeAccountMetadata",
      "docs": [
        "This is the metadata account for each staker",
        "It is derived from the checkpoints account with seeds \"stake_metadata\"",
        "and the checkpoints account pubkey",
        "It stores some PDA bumps, owner and delegate accounts"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "metadataBump",
            "type": "u8"
          },
          {
            "name": "custodyBump",
            "type": "u8"
          },
          {
            "name": "authorityBump",
            "type": "u8"
          },
          {
            "name": "voterBump",
            "type": "u8"
          },
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "delegate",
            "type": "publicKey"
          },
          {
            "name": "recordedBalance",
            "type": "u64"
          },
          {
            "name": "transferEpoch",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "signedAgreementHash",
            "type": {
              "option": {
                "array": [
                  "u8",
                  32
                ]
              }
            }
          }
        ]
      }
    },
    {
      "name": "voterWeightRecord",
      "docs": [
        "VoterWeightRecord account"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "realm",
            "docs": [
              "The Realm the VoterWeightRecord belongs to"
            ],
            "type": "publicKey"
          },
          {
            "name": "governingTokenMint",
            "docs": [
              "Governing Token Mint the VoterWeightRecord is associated with"
            ],
            "type": "publicKey"
          },
          {
            "name": "governingTokenOwner",
            "docs": [
              "The owner of the governing token and voter",
              "This is the actual owner (voter) and corresponds to",
              "TokenOwnerRecord.governing_token_owner"
            ],
            "type": "publicKey"
          },
          {
            "name": "voterWeight",
            "docs": [
              "Voter's weight"
            ],
            "type": "u64"
          },
          {
            "name": "weightAction",
            "docs": [
              "The governance action the voter's weight pertains to",
              "It allows to provided voter's weight specific to the particular action",
              "the weight is evaluated for."
            ],
            "type": {
              "option": {
                "defined": "VoterWeightAction"
              }
            }
          },
          {
            "name": "weightActionTarget",
            "docs": [
              "The target the voter's weight  action pertains to",
              "It allows to provided voter's weight specific to the target the weight",
              "is evaluated for. For example when addin supplies weight to vote on a",
              "particular proposal then it must specify the proposal as the action",
              "target."
            ],
            "type": {
              "option": "publicKey"
            }
          },
          {
            "name": "reserved",
            "docs": [
              "Reserved space for future versions"
            ],
            "type": {
              "array": [
                "u8",
                8
              ]
            }
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "Checkpoint",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "value",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "VoterWeightAction",
      "docs": [
        "The governance action VoterWeight is evaluated for"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "CastVote"
          },
          {
            "name": "CreateGovernance"
          },
          {
            "name": "CreateProposal"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "DelegateVotesChanged",
      "fields": [
        {
          "name": "delegate",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "previousBalance",
          "type": "u64",
          "index": false
        },
        {
          "name": "newBalance",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "DelegateChanged",
      "fields": [
        {
          "name": "delegator",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "fromDelegate",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "toDelegate",
          "type": "publicKey",
          "index": false
        }
      ]
    },
    {
      "name": "VoteCast",
      "fields": [
        {
          "name": "voter",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "proposalId",
          "type": "u64",
          "index": false
        },
        {
          "name": "weight",
          "type": "u64",
          "index": false
        },
        {
          "name": "againstVotes",
          "type": "u64",
          "index": false
        },
        {
          "name": "forVotes",
          "type": "u64",
          "index": false
        },
        {
          "name": "abstainVotes",
          "type": "u64",
          "index": false
        }
      ]
    },
    {
      "name": "ProposalCreated",
      "fields": [
        {
          "name": "proposalId",
          "type": "u64",
          "index": false
        },
        {
          "name": "voteStart",
          "type": "u64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "TooManyCheckpoints",
      "msg": "Number of checkpoint limit reached"
    },
    {
      "code": 6001,
      "name": "ZeroEpochDuration",
      "msg": "Epoch duration is 0"
    },
    {
      "code": 6002,
      "name": "GenericOverflow",
      "msg": "An arithmetic operation unexpectedly overflowed"
    },
    {
      "code": 6003,
      "name": "CheckpointSerDe",
      "msg": "Error deserializing checkpoint"
    },
    {
      "code": 6004,
      "name": "CheckpointOutOfBounds",
      "msg": "Checkpoint out of bounds"
    },
    {
      "code": 6005,
      "name": "NotLlcMember",
      "msg": "You need to be an LLC member to perform this action"
    },
    {
      "code": 6006,
      "name": "RecoverWithStake",
      "msg": "Can't recover account with a non-zero staking balance. Unstake your tokens first."
    },
    {
      "code": 6007,
      "name": "CheckpointNotFound",
      "msg": "Checkpoint not found"
    },
    {
      "code": 6008,
      "name": "InvalidTimestamp",
      "msg": "Invalid timestamp"
    },
    {
      "code": 6009,
      "name": "InvalidLlcAgreement",
      "msg": "Invalid LLC agreement"
    },
    {
      "code": 6010,
      "name": "NoWeight",
      "msg": "No Weight"
    },
    {
      "code": 6011,
      "name": "AllWeightCast",
      "msg": "All weight cast"
    },
    {
      "code": 6012,
      "name": "VoteWouldExceedWeight",
      "msg": "Vote would exceed weight"
    },
    {
      "code": 6013,
      "name": "WithdrawToUnauthorizedAccount",
      "msg": "Owner needs to own destination account"
    },
    {
      "code": 6014,
      "name": "InsufficientWithdrawableBalance",
      "msg": "Insufficient balance to cover the withdrawal"
    },
    {
      "code": 6015,
      "name": "ProposalAlreadyExists",
      "msg": "Proposal already exists"
    },
    {
      "code": 6016,
      "name": "Other",
      "msg": "Other"
    }
  ]
};
