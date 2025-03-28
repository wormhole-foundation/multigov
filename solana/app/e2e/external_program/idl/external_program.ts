/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/external_program.json`.
 */
export type ExternalProgram = {
  address: "eLUV8cwhgUC2Bcu4UA16uhuMwK8zPkx3XSzt4hd3JJ3";
  metadata: {
    name: "externalProgram";
    version: "0.1.0";
    spec: "0.1.0";
  };
  instructions: [
    {
      name: "adminAction";
      discriminator: [37, 85, 83, 175, 64, 105, 224, 66];
      accounts: [
        {
          name: "admin";
          docs: ["CHECK"];
          writable: true;
          relations: ["config"];
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103, 86, 50];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [];
    },
    {
      name: "initialize";
      discriminator: [175, 175, 109, 31, 13, 152, 155, 237];
      accounts: [
        {
          name: "payer";
          writable: true;
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103, 86, 50];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "superAdmin";
          type: "pubkey";
        },
        {
          name: "admin";
          type: "pubkey";
        },
      ];
    },
    {
      name: "updateAdmin";
      discriminator: [161, 176, 40, 213, 60, 184, 179, 228];
      accounts: [
        {
          name: "superAdmin";
          writable: true;
          signer: true;
        },
        {
          name: "config";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103, 86, 50];
              },
            ];
          };
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
      ];
      args: [
        {
          name: "newAdmin";
          type: "pubkey";
        },
      ];
    },
  ];
  accounts: [
    {
      name: "config";
      discriminator: [155, 12, 170, 224, 30, 250, 204, 130];
    },
  ];
  events: [
    {
      name: "adminActionEvent";
      discriminator: [220, 224, 207, 200, 52, 226, 42, 155];
    },
    {
      name: "updateAdminEvent";
      discriminator: [225, 152, 171, 87, 246, 63, 66, 234];
    },
  ];
  errors: [
    {
      code: 6000;
      name: "unauthorized";
      msg: "Unauthorized: Only the admin can perform this action.";
    },
  ];
  types: [
    {
      name: "adminActionEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "count";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "config";
      type: {
        kind: "struct";
        fields: [
          {
            name: "superAdmin";
            type: "pubkey";
          },
          {
            name: "admin";
            type: "pubkey";
          },
          {
            name: "counter";
            type: "u64";
          },
        ];
      };
    },
    {
      name: "updateAdminEvent";
      type: {
        kind: "struct";
        fields: [
          {
            name: "previousAdmin";
            type: "pubkey";
          },
          {
            name: "newAdmin";
            type: "pubkey";
          },
        ];
      };
    },
  ];
};
