/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/staking.json`.
 */
export type Staking = {
  "address": "5Vry3MrbhPCBWuviXVgcLQzhQ1mRsVfmQyNFuDgcPUAQ",
  "metadata": {
    "name": "staking",
    "version": "1.3.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addProposal",
      "discriminator": [
        130,
        139,
        214,
        107,
        93,
        13,
        84,
        152
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "proposalId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
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
      "discriminator": [
        20,
        212,
        15,
        189,
        69,
        180,
        69,
        151
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "proposal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108
                ]
              },
              {
                "kind": "arg",
                "path": "proposalId"
              }
            ]
          }
        },
        {
          "name": "voterCheckpoints",
          "writable": true
        },
        {
          "name": "proposalVotersWeightCast",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  112,
                  111,
                  115,
                  97,
                  108,
                  95,
                  118,
                  111,
                  116,
                  101,
                  114,
                  115,
                  95,
                  119,
                  101,
                  105,
                  103,
                  104,
                  116,
                  95,
                  99,
                  97,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "proposal"
              },
              {
                "kind": "account",
                "path": "voterCheckpoints"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
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
      "name": "createStakeAccount",
      "docs": [
        "Trustless instruction that creates a stake account for a user"
      ],
      "discriminator": [
        105,
        24,
        131,
        19,
        201,
        250,
        157,
        73
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "stakeAccountCheckpoints",
          "writable": true
        },
        {
          "name": "stakeAccountMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "custodyAuthority",
          "docs": [
            "CHECK : This AccountInfo is safe because it's a checked PDA"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "stakeAccountCustody",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "owner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "delegate",
      "discriminator": [
        90,
        147,
        75,
        178,
        85,
        88,
        4,
        137
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "currentDelegateStakeAccountCheckpoints",
          "writable": true
        },
        {
          "name": "currentDelegateStakeAccountMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "currentDelegateStakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "delegateeStakeAccountCheckpoints",
          "writable": true
        },
        {
          "name": "delegateeStakeAccountMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "delegateeStakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "stakeAccountCheckpoints",
          "writable": true
        },
        {
          "name": "stakeAccountMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "custodyAuthority",
          "docs": [
            "CHECK : This AccountInfo is safe because it's a checked PDA"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "stakeAccountCustody",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint"
        }
      ],
      "args": [
        {
          "name": "delegatee",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initConfig",
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "configAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "globalConfig",
          "type": {
            "defined": {
              "name": "globalConfig"
            }
          }
        }
      ]
    },
    {
      "name": "joinDaoLlc",
      "docs": [
        "* Accept to join the DAO LLC\n     * This must happen before delegate\n     * The user signs a hash of the agreement and the program checks that the hash matches the\n     * agreement"
      ],
      "discriminator": [
        79,
        241,
        203,
        177,
        232,
        143,
        124,
        14
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "stakeAccountCheckpoints"
        },
        {
          "name": "stakeAccountMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
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
      "discriminator": [
        240,
        223,
        246,
        118,
        26,
        121,
        34,
        128
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "payerTokenAccount"
        },
        {
          "name": "stakeAccountCheckpoints",
          "writable": true
        },
        {
          "name": "stakeAccountMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "updateAgreementHash",
      "discriminator": [
        86,
        232,
        181,
        137,
        158,
        110,
        129,
        238
      ],
      "accounts": [
        {
          "name": "governanceSigner",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
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
      "name": "updateGovernanceAuthority",
      "discriminator": [
        11,
        185,
        227,
        55,
        39,
        32,
        168,
        14
      ],
      "accounts": [
        {
          "name": "governanceSigner",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "updatePdaAuthority",
      "discriminator": [
        178,
        112,
        199,
        196,
        59,
        40,
        140,
        61
      ],
      "accounts": [
        {
          "name": "governanceSigner",
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "withdrawTokens",
      "discriminator": [
        2,
        4,
        225,
        61,
        19,
        182,
        106,
        170
      ],
      "accounts": [
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "currentDelegateStakeAccountCheckpoints",
          "writable": true
        },
        {
          "name": "currentDelegateStakeAccountMetadata",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "currentDelegateStakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "destination",
          "writable": true
        },
        {
          "name": "stakeAccountCheckpoints"
        },
        {
          "name": "stakeAccountMetadata",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "stakeAccountCustody",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  117,
                  115,
                  116,
                  111,
                  100,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "custodyAuthority",
          "docs": [
            "CHECK : This AccountInfo is safe because it's a checked PDA"
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "stakeAccountCheckpoints"
              }
            ]
          }
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "checkpointData",
      "discriminator": [
        163,
        219,
        133,
        148,
        129,
        79,
        209,
        195
      ]
    },
    {
      "name": "globalConfig",
      "discriminator": [
        149,
        8,
        156,
        202,
        160,
        252,
        176,
        217
      ]
    },
    {
      "name": "proposalData",
      "discriminator": [
        194,
        86,
        123,
        172,
        146,
        28,
        191,
        244
      ]
    },
    {
      "name": "proposalVotersWeightCast",
      "discriminator": [
        42,
        161,
        214,
        215,
        3,
        32,
        96,
        196
      ]
    },
    {
      "name": "stakeAccountMetadata",
      "discriminator": [
        68,
        11,
        237,
        138,
        61,
        33,
        15,
        93
      ]
    }
  ],
  "events": [
    {
      "name": "delegateChanged",
      "discriminator": [
        225,
        147,
        224,
        43,
        247,
        130,
        101,
        91
      ]
    },
    {
      "name": "delegateVotesChanged",
      "discriminator": [
        12,
        90,
        174,
        82,
        144,
        70,
        63,
        194
      ]
    },
    {
      "name": "proposalCreated",
      "discriminator": [
        186,
        8,
        160,
        108,
        81,
        13,
        51,
        206
      ]
    },
    {
      "name": "voteCast",
      "discriminator": [
        39,
        53,
        195,
        104,
        188,
        17,
        225,
        213
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "tooManyCheckpoints",
      "msg": "Number of checkpoint limit reached"
    },
    {
      "code": 6001,
      "name": "genericOverflow",
      "msg": "An arithmetic operation unexpectedly overflowed"
    },
    {
      "code": 6002,
      "name": "checkpointSerDe",
      "msg": "Error deserializing checkpoint"
    },
    {
      "code": 6003,
      "name": "checkpointOutOfBounds",
      "msg": "Checkpoint out of bounds"
    },
    {
      "code": 6004,
      "name": "notLlcMember",
      "msg": "You need to be an LLC member to perform this action"
    },
    {
      "code": 6005,
      "name": "recoverWithStake",
      "msg": "Can't recover account with a non-zero staking balance. Unstake your tokens first."
    },
    {
      "code": 6006,
      "name": "checkpointNotFound",
      "msg": "Checkpoint not found"
    },
    {
      "code": 6007,
      "name": "invalidTimestamp",
      "msg": "Invalid timestamp"
    },
    {
      "code": 6008,
      "name": "invalidLlcAgreement",
      "msg": "Invalid LLC agreement"
    },
    {
      "code": 6009,
      "name": "noWeight",
      "msg": "No Weight"
    },
    {
      "code": 6010,
      "name": "allWeightCast",
      "msg": "All weight cast"
    },
    {
      "code": 6011,
      "name": "voteWouldExceedWeight",
      "msg": "Vote would exceed weight"
    },
    {
      "code": 6012,
      "name": "withdrawToUnauthorizedAccount",
      "msg": "Owner needs to own destination account"
    },
    {
      "code": 6013,
      "name": "insufficientWithdrawableBalance",
      "msg": "Insufficient balance to cover the withdrawal"
    },
    {
      "code": 6014,
      "name": "proposalAlreadyExists",
      "msg": "Proposal already exists"
    },
    {
      "code": 6015,
      "name": "other",
      "msg": "other"
    }
  ],
  "types": [
    {
      "name": "checkpointData",
      "serialization": "bytemuck",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "nextIndex",
            "type": "u64"
          },
          {
            "name": "checkpoints",
            "type": {
              "defined": {
                "name": "checkpoints"
              }
            }
          }
        ]
      }
    },
    {
      "name": "checkpoints",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "array": [
              {
                "array": [
                  "u8",
                  24
                ]
              },
              424
            ]
          }
        ]
      }
    },
    {
      "name": "delegateChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "delegator",
            "type": "pubkey"
          },
          {
            "name": "fromDelegate",
            "type": "pubkey"
          },
          {
            "name": "toDelegate",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "delegateVotesChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "delegate",
            "type": "pubkey"
          },
          {
            "name": "previousBalance",
            "type": "u64"
          },
          {
            "name": "newBalance",
            "type": "u64"
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
            "type": "pubkey"
          },
          {
            "name": "whTokenMint",
            "type": "pubkey"
          },
          {
            "name": "freeze",
            "type": "bool"
          },
          {
            "name": "pdaAuthority",
            "type": "pubkey"
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
      "name": "proposalCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "proposalId",
            "type": "u64"
          },
          {
            "name": "voteStart",
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
            "type": "pubkey"
          },
          {
            "name": "value",
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
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "delegate",
            "type": "pubkey"
          },
          {
            "name": "recordedBalance",
            "type": "u64"
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
      "name": "voteCast",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "proposalId",
            "type": "u64"
          },
          {
            "name": "weight",
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
      }
    }
  ]
};
