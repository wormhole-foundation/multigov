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
    "version": "1.4.0",
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
          "type": {
            "array": [
              "u8",
              32
            ]
          }
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
      "name": "cancelVesting",
      "discriminator": [
        171,
        166,
        241,
        72,
        155,
        48,
        30,
        253
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "vesterTa"
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
              },
              {
                "kind": "account",
                "path": "admin"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "config.seed",
                "account": "config"
              }
            ]
          },
          "relations": [
            "vest"
          ]
        },
        {
          "name": "vest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "vest.vester_ta",
                "account": "vesting"
              },
              {
                "kind": "account",
                "path": "vest.maturation",
                "account": "vesting"
              }
            ]
          }
        },
        {
          "name": "vestingBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "vesterTa"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
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
          "type": {
            "array": [
              "u8",
              32
            ]
          }
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
      "name": "claimVesting",
      "discriminator": [
        134,
        160,
        202,
        203,
        151,
        219,
        16,
        125
      ],
      "accounts": [
        {
          "name": "vester",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vesterTa",
          "writable": true,
          "relations": [
            "vest",
            "vestingBalance"
          ]
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
              },
              {
                "kind": "account",
                "path": "config.admin",
                "account": "config"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "config.seed",
                "account": "config"
              }
            ]
          },
          "relations": [
            "vest"
          ]
        },
        {
          "name": "vest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "vesterTa"
              },
              {
                "kind": "account",
                "path": "vest.maturation",
                "account": "vesting"
              }
            ]
          }
        },
        {
          "name": "vestingBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "vesterTa"
              }
            ]
          }
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
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
      "name": "createVesting",
      "discriminator": [
        135,
        184,
        171,
        156,
        197,
        162,
        246,
        44
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "mint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "vesterTa"
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
              },
              {
                "kind": "account",
                "path": "admin"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "config.seed",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "vest",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  115,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "vesterTa"
              },
              {
                "kind": "arg",
                "path": "maturation"
              }
            ]
          }
        },
        {
          "name": "vestingBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "vesterTa"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "maturation",
          "type": "i64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createVestingBalance",
      "discriminator": [
        101,
        79,
        88,
        204,
        141,
        175,
        226,
        216
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "vestingBalance",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
                  98,
                  97,
                  108,
                  97,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "vesterTa"
              }
            ]
          }
        },
        {
          "name": "vesterTa"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
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
          "name": "vestingBalance",
          "optional": true
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
      "name": "executeOperation",
      "discriminator": [
        105,
        240,
        250,
        159,
        65,
        132,
        111,
        185
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "airlock",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  108,
                  111,
                  99,
                  107
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "cpiTargetProgramId",
          "type": "pubkey"
        },
        {
          "name": "instructionData",
          "type": "bytes"
        },
        {
          "name": "value",
          "type": "u64"
        }
      ]
    },
    {
      "name": "finalizeVestingConfig",
      "discriminator": [
        172,
        129,
        185,
        180,
        183,
        173,
        53,
        126
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
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
              },
              {
                "kind": "account",
                "path": "admin"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "config.seed",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
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
      "name": "initializeSpokeAirlock",
      "discriminator": [
        43,
        108,
        186,
        101,
        188,
        130,
        241,
        172
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "airlock",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  108,
                  111,
                  99,
                  107
                ]
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
          "name": "messageExecutor",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeSpokeMessageExecutor",
      "discriminator": [
        0,
        62,
        206,
        121,
        203,
        198,
        201,
        177
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "executor",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  111,
                  107,
                  101,
                  95,
                  109,
                  101,
                  115,
                  115,
                  97,
                  103,
                  101,
                  95,
                  101,
                  120,
                  101,
                  99,
                  117,
                  116,
                  111,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "hubDispatcher"
        },
        {
          "name": "airlock",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  108,
                  111,
                  99,
                  107
                ]
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
          "name": "hubChainId",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeVestingConfig",
      "discriminator": [
        16,
        53,
        86,
        253,
        175,
        121,
        202,
        87
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "recovery"
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
              },
              {
                "kind": "account",
                "path": "admin"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "arg",
                "path": "seed"
              }
            ]
          }
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "seed",
          "type": "u64"
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
      "name": "setAirlock",
      "discriminator": [
        78,
        190,
        90,
        185,
        79,
        223,
        32,
        81
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "executor",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  112,
                  111,
                  107,
                  101,
                  95,
                  109,
                  101,
                  115,
                  115,
                  97,
                  103,
                  101,
                  95,
                  101,
                  120,
                  101,
                  99,
                  117,
                  116,
                  111,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "airlock",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  108,
                  111,
                  99,
                  107
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "setMessageReceived",
      "discriminator": [
        170,
        14,
        143,
        39,
        174,
        228,
        118,
        177
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "messageReceived",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  115,
                  115,
                  97,
                  103,
                  101,
                  95,
                  114,
                  101,
                  99,
                  101,
                  105,
                  118,
                  101,
                  100
                ]
              },
              {
                "kind": "arg",
                "path": "messageHash"
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
          "name": "messageHash",
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
      "name": "withdrawSurplus",
      "discriminator": [
        150,
        183,
        243,
        31,
        213,
        21,
        79,
        26
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "recovery",
          "writable": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
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
              },
              {
                "kind": "account",
                "path": "config.admin",
                "account": "config"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "config.seed",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
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
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
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
      "name": "messageReceived",
      "discriminator": [
        159,
        83,
        82,
        195,
        196,
        71,
        241,
        221
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
      "name": "spokeAirlock",
      "discriminator": [
        116,
        204,
        166,
        85,
        235,
        207,
        0,
        58
      ]
    },
    {
      "name": "spokeMessageExecutor",
      "discriminator": [
        95,
        181,
        136,
        40,
        47,
        138,
        250,
        58
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
    },
    {
      "name": "vesting",
      "discriminator": [
        100,
        149,
        66,
        138,
        95,
        200,
        128,
        241
      ]
    },
    {
      "name": "vestingBalance",
      "discriminator": [
        224,
        70,
        78,
        128,
        120,
        199,
        9,
        182
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
      "name": "invalidMessageExecutor",
      "msg": "Invalid message executor"
    },
    {
      "code": 6016,
      "name": "invalidSpokeAirlock",
      "msg": "Invalid spoke airlock"
    },
    {
      "code": 6017,
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
              32
            ]
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "recovery",
            "type": "pubkey"
          },
          {
            "name": "seed",
            "type": "u64"
          },
          {
            "name": "vested",
            "type": "u64"
          },
          {
            "name": "finalized",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
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
      "name": "messageReceived",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "executed",
            "type": "bool"
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
            "type": {
              "array": [
                "u8",
                32
              ]
            }
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
            "type": {
              "array": [
                "u8",
                32
              ]
            }
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
            "type": {
              "array": [
                "u8",
                32
              ]
            }
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
      "name": "spokeAirlock",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "messageExecutor",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "spokeMessageExecutor",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "hubDispatcher",
            "type": "pubkey"
          },
          {
            "name": "hubChainId",
            "type": "u16"
          },
          {
            "name": "spokeChainId",
            "type": "u16"
          },
          {
            "name": "wormholeCore",
            "type": "pubkey"
          },
          {
            "name": "airlock",
            "type": "pubkey"
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
            "name": "recordedVestingBalance",
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
      "name": "vesting",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vesterTa",
            "type": "pubkey"
          },
          {
            "name": "config",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "maturation",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vestingBalance",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vesterTa",
            "type": "pubkey"
          },
          {
            "name": "totalVestingBalance",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
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
            "type": {
              "array": [
                "u8",
                32
              ]
            }
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
