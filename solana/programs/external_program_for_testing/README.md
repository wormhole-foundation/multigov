# External Program for EVM-Solana E2E Testing

This folder contains a simple Anchor-based Solana program used exclusively for end-to-end (E2E) testing in the development environment. 

The purpose of this program is to verify the proper execution of the `ReceiveMessage` instruction in the Solana devnet. By doing so, this program helps validate the delivery of cross-chain messages from EVM to Solana.

## Program Details
The program consists of the following key elements:
- **Initialize Instruction**: Sets up a configuration account with an admin address and initializes a counter to `0`.
- **AdminAction Instruction**: Increments the counter only if the provided admin address matches the stored admin address.
- **UpdateAdmin Instruction**: Allows a predefined super admin to update the admin address stored in the configuration account.

### Purpose of UpdateAdmin
The update_admin instruction ensures that only a predefined super admin (Di6Aa86NHTPc8SDNTognMamfjWVcHbYFkX5spuohPJbo) can update the admin address stored in the configuration account.

### Purpose of the Counter
The counter is used to ensure that the `AdminAction` instruction executes successfully in the Solana devnet. Each successful call increments the counter, which is logged for verification.

## How to Use
1. Deploy the program to Solana devnet.
2. Use the accompanying E2E test scripts to interact with this program.
3. Verify that the instruction executes properly by observing the counter value in the logs.

## Testing Flow
1. **Generate Payload**: The script generates a Solana instruction payload using this external program.
2. **Dispatch Payload**: The payload is dispatched to Solana via the EVM contract (`HubSolanaMessageDispatcher`).
3. **Verify Execution**: Check the success of the instruction by checking the increment of the counter.

## Note
This program is intended **only for testing purposes** in the devnet and should not be used in production.
