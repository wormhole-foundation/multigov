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
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
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
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
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
      "name": "stakeAccountMetadata",
      "docs": [
        "This is the metadata account for each staker",
        "It is derived from the positions account with seeds \"stake_metadata\" and the positions account",
        "pubkey It stores some PDA bumps, the owner of the account"
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
            "name": "nextIndex",
            "type": "u8"
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
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ZeroEpochDuration",
      "msg": "Epoch duration is 0"
    },
    {
      "code": 6001,
      "name": "GenericOverflow",
      "msg": "An arithmetic operation unexpectedly overflowed"
    },
    {
      "code": 6002,
      "name": "NotLlcMember",
      "msg": "You need to be an LLC member to perform this action"
    },
    {
      "code": 6003,
      "name": "RecoverWithStake",
      "msg": "Can't recover account with staking positions. Unstake your tokens first."
    },
    {
      "code": 6004,
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
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
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
          "name": "stakeAccountMetadata",
          "isMut": true,
          "isSigner": false,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "type": "string",
                "value": "stake_metadata"
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
      "name": "stakeAccountMetadata",
      "docs": [
        "This is the metadata account for each staker",
        "It is derived from the positions account with seeds \"stake_metadata\" and the positions account",
        "pubkey It stores some PDA bumps, the owner of the account"
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
            "name": "nextIndex",
            "type": "u8"
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
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "ZeroEpochDuration",
      "msg": "Epoch duration is 0"
    },
    {
      "code": 6001,
      "name": "GenericOverflow",
      "msg": "An arithmetic operation unexpectedly overflowed"
    },
    {
      "code": 6002,
      "name": "NotLlcMember",
      "msg": "You need to be an LLC member to perform this action"
    },
    {
      "code": 6003,
      "name": "RecoverWithStake",
      "msg": "Can't recover account with staking positions. Unstake your tokens first."
    },
    {
      "code": 6004,
      "name": "Other",
      "msg": "Other"
    }
  ]
};
