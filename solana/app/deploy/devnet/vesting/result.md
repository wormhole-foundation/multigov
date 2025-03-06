npx ts-node app/deploy/devnet/vesting/createVestingConfig.ts

Vesting claim times:
NOW: 1741270829 (2025-03-06T14:20:29.000Z)
LATER: 1741271829 (2025-03-06T14:37:09.000Z)
EVEN_LATER: 1741272829 (2025-03-06T14:53:49.000Z)
Vesting config random seed: <BN: ff5b44e2d4a9cd83>
seedBuffer: <Buffer 83 cd a9 d4 e2 44 5b ff>
seedBufferHex: 83cda9d4e2445bff
Vesting config account: PublicKey [PublicKey(AHfPLNVnRGoACwMfoRCwWnCEJWjMX4x7Yq3ufg3tpjQQ)] {
  _bn: <BN: 89fde09e733d77369924c7f4cf97609f11cc765f27c1f180f5f3eb266997e2bd>
}
Vesting balance account for vester: PublicKey [PublicKey(GCSubvJoUD5hDbzZeLVWzBGkbej22wUkT1aZgYPDLyzW)] {
  _bn: <BN: e1cdfc6116b6f0faecabb12ddc642a28b0d4e8bca819336a4df3e41b44a14b9f>
}
Initializing vesting config...
Vesting config initialized
Creating vesting balance for vester...
Vesting balance for vester created
Creating vest for vester at NOW (1741270829)...
Vest for vester at NOW (1741270829) created
Creating vest for vester at LATER (1741271829)...
Vest for vester at LATER (1741271829) created
Creating vest for vester at EVEN_LATER (1741272829)...
Vest for vester at EVEN_LATER (1741272829) created
Canceling vest for vester at LATER (1741271829)...
Vest for vester at LATER (1741271829) canceled
Transferring WH tokens to Vault...
WH tokens transferred to Vault
Withdrawing surplus...
Surplus withdrawn
Finalizing vesting config...
Vesting config finalized

----------------

npx ts-node app/deploy/devnet/vesting/claimVesting.ts

Vesting config account: PublicKey [PublicKey(AHfPLNVnRGoACwMfoRCwWnCEJWjMX4x7Yq3ufg3tpjQQ)] {
  _bn: <BN: 89fde09e733d77369924c7f4cf97609f11cc765f27c1f180f5f3eb266997e2bd>
}
Starting claimVesting...
claimVesting completed successfully.

----------------

npx ts-node app/deploy/devnet/vesting/delegateWithVest.ts

Delegate WH tokens with vests
WH tokens with vests successfully delegated

----------------

npx ts-node app/deploy/devnet/vesting/transferVesting.ts

vestingBalanceAccount.totalVestingBalance:  20000000
Starting transferVesting...
transferVesting completed successfully.
vestingBalanceAccount.totalVestingBalance:  0
newVestingBalanceAccount.totalVestingBalance:  20000000
vesterStakeMetadata.recordedVestingBalance:  20000000
vesterStakeMetadata.recordedBalance:  50000040000150
