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
          "name": "guardianSet",
          "docs": [
            "Guardian set used for signature verification."
          ],
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  71,
                  117,
                  97,
                  114,
                  100,
                  105,
                  97,
                  110,
                  83,
                  101,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "guardianSetIndex"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                43,
                18,
                70,
                201,
                238,
                250,
                60,
                70,
                103,
                146,
                37,
                49,
                17,
                243,
                95,
                236,
                30,
                232,
                238,
                94,
                157,
                235,
                196,
                18,
                210,
                233,
                173,
                173,
                254,
                205,
                204,
                114
              ]
            }
          }
        },
        {
          "name": "guardianSignatures",
          "docs": [
            "Stores unverified guardian signatures as they are too large to fit in the instruction data."
          ],
          "writable": true
        },
        {
          "name": "refundRecipient",
          "relations": [
            "guardianSignatures"
          ]
        },
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
          "name": "spokeMetadataCollector",
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
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                  95,
                  99,
                  111,
                  108,
                  108,
                  101,
                  99,
                  116,
                  111,
                  114
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
          "name": "bytes",
          "type": "bytes"
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
          "name": "guardianSetIndex",
          "type": "u32"
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
                  118,
                  101,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
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
                "account": "vestingConfig"
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
                "path": "config"
              },
              {
                "kind": "account",
                "path": "vester_ta.owner"
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
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "voterCheckpoints"
          ]
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
          "signer": true,
          "relations": [
            "vestingBalance"
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
          "name": "vesterTa",
          "writable": true,
          "relations": [
            "vest"
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
                  118,
                  101,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
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
                "account": "vestingConfig"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "config.seed",
                "account": "vestingConfig"
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
                "path": "config"
              },
              {
                "kind": "account",
                "path": "vester_ta.owner"
              }
            ]
          }
        },
        {
          "name": "stakeAccountCheckpoints",
          "docs": [
            "CheckpointData and StakeAccountMetadata accounts are optional because",
            "in order to be able to claim vests that have not been delegated"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "stakeAccountMetadata",
          "writable": true,
          "optional": true
        },
        {
          "name": "globalConfig",
          "writable": true,
          "optional": true
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
      "name": "closeSignatures",
      "docs": [
        "Allows the initial payer to close the signature account in case the query was invalid."
      ],
      "discriminator": [
        192,
        65,
        63,
        117,
        213,
        138,
        179,
        190
      ],
      "accounts": [
        {
          "name": "guardianSignatures",
          "writable": true
        },
        {
          "name": "refundRecipient",
          "signer": true,
          "relations": [
            "guardianSignatures"
          ]
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
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  119,
                  110,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
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
                  118,
                  101,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
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
                "account": "vestingConfig"
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
                "path": "config"
              },
              {
                "kind": "account",
                "path": "vester_ta.owner"
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
          "name": "config",
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
                "account": "vestingConfig"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "config.seed",
                "account": "vestingConfig"
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
                "path": "config"
              },
              {
                "kind": "account",
                "path": "vester_ta.owner"
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
          "name": "vestingConfig",
          "writable": true,
          "optional": true
        },
        {
          "name": "vestingBalance",
          "writable": true,
          "optional": true
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
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
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
                  118,
                  101,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
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
                "account": "vestingConfig"
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
      "name": "initializeSpokeMetadataCollector",
      "discriminator": [
        87,
        206,
        214,
        2,
        27,
        75,
        52,
        125
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "spokeMetadataCollector",
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
                  116,
                  97,
                  100,
                  97,
                  116,
                  97,
                  95,
                  99,
                  111,
                  108,
                  108,
                  101,
                  99,
                  116,
                  111,
                  114
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
        },
        {
          "name": "hubProposalMetadata",
          "type": {
            "array": [
              "u8",
              20
            ]
          }
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
                  118,
                  101,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
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
      "name": "postSignatures",
      "discriminator": [
        138,
        2,
        53,
        166,
        45,
        77,
        137,
        51
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "guardianSignatures",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "guardianSignatures",
          "type": {
            "vec": {
              "array": [
                "u8",
                66
              ]
            }
          }
        },
        {
          "name": "totalSignatures",
          "type": "u8"
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
      "name": "updateVestingAdmin",
      "discriminator": [
        112,
        159,
        137,
        54,
        228,
        39,
        63,
        230
      ],
      "accounts": [
        {
          "name": "vestingAdmin",
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
          "name": "newVestingAdmin",
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
                  118,
                  101,
                  115,
                  116,
                  105,
                  110,
                  103,
                  95,
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
                "account": "vestingConfig"
              },
              {
                "kind": "account",
                "path": "mint"
              },
              {
                "kind": "account",
                "path": "config.seed",
                "account": "vestingConfig"
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
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
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
      "name": "guardianSignatures",
      "discriminator": [
        203,
        184,
        130,
        157,
        113,
        14,
        184,
        83
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
      "name": "spokeMetadataCollector",
      "discriminator": [
        233,
        64,
        21,
        231,
        81,
        240,
        52,
        222
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
    },
    {
      "name": "vestingConfig",
      "discriminator": [
        0,
        138,
        71,
        135,
        26,
        29,
        43,
        125
      ]
    },
    {
      "name": "wormholeGuardianSet",
      "discriminator": [
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
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
      "name": "notFullyVested",
      "msg": "Not fully vested yet"
    },
    {
      "code": 6001,
      "name": "notInSurplus",
      "msg": "Vault is not in surplus"
    },
    {
      "code": 6002,
      "name": "vestingFinalized",
      "msg": "Vesting finalized"
    },
    {
      "code": 6003,
      "name": "vestingUnfinalized",
      "msg": "Vesting unfinalized"
    },
    {
      "code": 6004,
      "name": "overflow",
      "msg": "Integer overflow"
    },
    {
      "code": 6005,
      "name": "underflow",
      "msg": "Integer underflow"
    },
    {
      "code": 6006,
      "name": "invalidStakeAccountCheckpoints",
      "msg": "Invalid stake account delegate"
    },
    {
      "code": 6007,
      "name": "errorOfStakeAccountParsing",
      "msg": "Error parsing stake_account_metadata and stake_account_checkpoints"
    },
    {
      "code": 6008,
      "name": "invalidVestingConfigPda",
      "msg": "Invalid vesting config PDA"
    },
    {
      "code": 6009,
      "name": "invalidVestingBalancePda",
      "msg": "Invalid vesting balance PDA"
    },
    {
      "code": 6010,
      "name": "invalidVestingMint",
      "msg": "Invalid vesting mint"
    },
    {
      "code": 6011,
      "name": "invalidStakeAccountOwner",
      "msg": "Invalid stake account owner"
    }
  ],
  "types": [
    {
      "name": "checkpointData",
      "docs": [
        "CheckpointData account has a fixed header (owner, next_index)",
        "and a dynamic tail where checkpoints are stored in byte format",
        "This is designed to be able to dynamically extend the CheckpointData account up to 10Mb",
        "This will save approximately 655,000 checkpoints into one account"
      ],
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
          },
          {
            "name": "totalDelegatedVotes",
            "type": "u64"
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
            "name": "freeze",
            "type": "bool"
          },
          {
            "name": "mockClockTime",
            "type": "i64"
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
            "name": "vestingAdmin",
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
          }
        ]
      }
    },
    {
      "name": "guardianSignatures",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "refundRecipient",
            "docs": [
              "Payer of this guardian signatures account.",
              "Only they may amend signatures.",
              "Used for reimbursements upon cleanup."
            ],
            "type": "pubkey"
          },
          {
            "name": "guardianSignatures",
            "docs": [
              "Unverified guardian signatures."
            ],
            "type": {
              "vec": {
                "array": [
                  "u8",
                  66
                ]
              }
            }
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
      "name": "spokeMetadataCollector",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "hubChainId",
            "type": "u16"
          },
          {
            "name": "hubProposalMetadata",
            "type": {
              "array": [
                "u8",
                20
              ]
            }
          },
          {
            "name": "wormholeCore",
            "type": "pubkey"
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
            "name": "recordedBalance",
            "type": "u64"
          },
          {
            "name": "recordedVestingBalance",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "delegate",
            "type": "pubkey"
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
      "docs": [
        "Used to store the total vesting balance of a single vester",
        "It is also used to delegate vesting"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vester",
            "type": "pubkey"
          },
          {
            "name": "totalVestingBalance",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "stakeAccountMetadata",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vestingConfig",
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
    },
    {
      "name": "wormholeGuardianSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "index",
            "docs": [
              "Index representing an incrementing version number for this guardian set."
            ],
            "type": "u32"
          },
          {
            "name": "keys",
            "docs": [
              "Ethereum-style public keys."
            ],
            "type": {
              "vec": {
                "array": [
                  "u8",
                  20
                ]
              }
            }
          },
          {
            "name": "creationTime",
            "docs": [
              "Timestamp representing the time this guardian became active."
            ],
            "type": "u32"
          },
          {
            "name": "expirationTime",
            "docs": [
              "Expiration time when VAAs issued by this set are no longer valid."
            ],
            "type": "u32"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "defaultSaveWindow",
      "docs": [
        "Save window by default"
      ],
      "type": "u64",
      "value": "86400"
    }
  ]
};
