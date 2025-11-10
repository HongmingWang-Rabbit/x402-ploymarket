/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/prediction_market.json`.
 */
export type PredictionMarket = {
  address: "CzddKJkrkAAsECFhEA1KzNpL7RdrZ6PYG7WEkNRrXWgM";
  metadata: {
    name: "predictionMarket";
    version: "1.1.1";
    spec: "0.1.0";
    description: "Solana Prediction Market - USDC Migration + Code Quality Polish";
  };
  instructions: [
    {
      name: "acceptAuthority";
      discriminator: [107, 86, 198, 91, 33, 12, 107, 160];
      accounts: [
        {
          name: "newAdmin";
          writable: true;
          signer: true;
        },
        {
          name: "globalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              }
            ];
          };
        }
      ];
      args: [];
    },
    {
      name: "addLiquidity";
      discriminator: [181, 157, 89, 67, 143, 182, 52, 72];
      accounts: [
        {
          name: "globalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              }
            ];
          };
        },
        {
          name: "market";
          writable: true;
        },
        {
          name: "yesToken";
          writable: true;
        },
        {
          name: "noToken";
          writable: true;
        },
        {
          name: "globalVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 108, 111, 98, 97, 108];
              }
            ];
          };
        },
        {
          name: "globalYesAta";
          writable: true;
        },
        {
          name: "globalNoAta";
          writable: true;
        },
        {
          name: "usdcMint";
        },
        {
          name: "marketUsdcAta";
          writable: true;
        },
        {
          name: "marketUsdcVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [109, 97, 114, 107, 101, 116, 95, 117, 115, 100, 99, 95, 118, 97, 117, 108, 116];
              },
              {
                kind: "account";
                path: "market";
              }
            ];
          };
        },
        {
          name: "userUsdcAta";
          writable: true;
        },
        {
          name: "lpPosition";
          writable: true;
        },
        {
          name: "user";
          writable: true;
          signer: true;
        },
        {
          name: "tokenProgram";
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        }
      ];
      args: [
        {
          name: "usdcAmount";
          type: "u64";
        }
      ];
    },
    {
      name: "mintNoToken";
      discriminator: [198, 161, 208, 188, 122, 69, 236, 128];
      accounts: [
        {
          name: "globalConfig";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [99, 111, 110, 102, 105, 103];
              }
            ];
          };
        },
        {
          name: "globalVault";
          writable: true;
          pda: {
            seeds: [
              {
                kind: "const";
                value: [103, 108, 111, 98, 97, 108];
              }
            ];
          };
        },
        {
          name: "creator";
          writable: true;
          signer: true;
        },
        {
          name: "noToken";
          writable: true;
          signer: true;
        },
        {
          name: "noTokenMetadataAccount";
          writable: true;
        },
        {
          name: "globalNoTokenAccount";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "mplTokenMetadataProgram";
          address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
        }
      ];
      args: [
        {
          name: "noSymbol";
          type: "string";
        },
        {
          name: "noUri";
          type: "string";
        }
      ];
    },
    {
      name: "createMarket";
      discriminator: [220, 251, 58, 156, 186, 43, 90, 55];
      accounts: [
        {
          name: "globalConfig";
          writable: true;
        },
        {
          name: "globalVault";
          writable: true;
        },
        {
          name: "creator";
          writable: true;
          signer: true;
        },
        {
          name: "creatorWhitelist";
        },
        {
          name: "yesToken";
          writable: true;
          signer: true;
        },
        {
          name: "noToken";
          writable: true;
        },
        {
          name: "market";
          writable: true;
        },
        {
          name: "yesTokenMetadataAccount";
          writable: true;
        },
        {
          name: "noTokenMetadataAccount";
          writable: true;
        },
        {
          name: "globalYesTokenAccount";
          writable: true;
        },
        {
          name: "globalNoTokenAccount";
          writable: true;
        },
        {
          name: "systemProgram";
          address: "11111111111111111111111111111111";
        },
        {
          name: "rent";
          address: "SysvarRent111111111111111111111111111111111";
        },
        {
          name: "tokenProgram";
          address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        },
        {
          name: "associatedTokenProgram";
          address: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
        },
        {
          name: "mplTokenMetadataProgram";
          address: "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
        },
        {
          name: "teamWallet";
        }
      ];
      args: [
        {
          name: "yesSymbol";
          type: "string";
        },
        {
          name: "yesUri";
          type: "string";
        },
        {
          name: "startSlot";
          type: {
            option: "u64";
          };
        },
        {
          name: "endingSlot";
          type: {
            option: "u64";
          };
        },
        {
          name: "lmsrB";
          type: {
            option: "u64";
          };
        }
      ];
    }
  ];
};
