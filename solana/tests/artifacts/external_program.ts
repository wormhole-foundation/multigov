/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/external_program.json`.
 */
export type ExternalProgram = {
  "address": "675LNkgUdRCq4EtSmNHJhdUYWPWR34K2zyj6jkhUh6YL",
  "metadata": {
    "name": "externalProgram",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "adminAction",
      "discriminator": [
        37,
        85,
        83,
        175,
        64,
        105,
        224,
        66
      ],
      "accounts": [
        {
          "name": "admin",
          "docs": [
            "CHECK"
          ],
          "writable": true,
          "relations": [
            "config"
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
                  103,
                  86,
                  50
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
      "args": []
    },
    {
      "name": "appendPayload",
      "discriminator": [
        254,
        65,
        54,
        181,
        187,
        35,
        12,
        83
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "buffer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
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
          "name": "remainingPayload",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
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
                  103,
                  86,
                  50
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
          "name": "superAdmin",
          "type": "pubkey"
        },
        {
          "name": "admin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "populateBuffer",
      "discriminator": [
        131,
        31,
        126,
        77,
        118,
        217,
        5,
        227
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "buffer",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
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
          "name": "payloadLen",
          "type": "u64"
        },
        {
          "name": "data",
          "type": {
            "defined": {
              "name": "vaaData"
            }
          }
        }
      ]
    },
    {
      "name": "postVaa",
      "discriminator": [
        8,
        15,
        198,
        170,
        97,
        124,
        250,
        101
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "buffer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              }
            ]
          }
        },
        {
          "name": "wormholeProgram",
          "docs": [
            "These accounts will be verified by Core bridge on CPI"
          ]
        },
        {
          "name": "guardianSet"
        },
        {
          "name": "bridge"
        },
        {
          "name": "signatureSet"
        },
        {
          "name": "vaa",
          "writable": true
        },
        {
          "name": "payer",
          "signer": true
        },
        {
          "name": "clock",
          "address": "SysvarC1ock11111111111111111111111111111111"
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
      "args": []
    },
    {
      "name": "updateAdmin",
      "discriminator": [
        161,
        176,
        40,
        213,
        60,
        184,
        179,
        228
      ],
      "accounts": [
        {
          "name": "superAdmin",
          "writable": true,
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
                  103,
                  86,
                  50
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
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
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
      "name": "vaaData",
      "discriminator": [
        109,
        131,
        182,
        50,
        252,
        3,
        49,
        51
      ]
    }
  ],
  "events": [
    {
      "name": "adminActionEvent",
      "discriminator": [
        220,
        224,
        207,
        200,
        52,
        226,
        42,
        155
      ]
    },
    {
      "name": "updateAdminEvent",
      "discriminator": [
        225,
        152,
        171,
        87,
        246,
        63,
        66,
        234
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Unauthorized: Only the admin can perform this action."
    }
  ],
  "types": [
    {
      "name": "adminActionEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "count",
            "type": "u64"
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
            "name": "superAdmin",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "counter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "updateAdminEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "previousAdmin",
            "type": "pubkey"
          },
          {
            "name": "newAdmin",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vaaData",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "guardianSetIndex",
            "type": "u32"
          },
          {
            "name": "timestamp",
            "type": "u32"
          },
          {
            "name": "nonce",
            "type": "u32"
          },
          {
            "name": "emitterChain",
            "type": "u16"
          },
          {
            "name": "emitterAddress",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "sequence",
            "type": "u64"
          },
          {
            "name": "consistencyLevel",
            "type": "u8"
          },
          {
            "name": "payload",
            "type": "bytes"
          }
        ]
      }
    }
  ]
};
