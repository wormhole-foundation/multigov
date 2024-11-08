import { describe, expect, test } from 'bun:test';
import { createClients } from 'test/config/clients';
import { parseEther } from 'viem';
import {
  createAndExecuteCrossChainProposal,
  createArbitraryProposalDataForSpokeExecution,
  getSpokeAirlock,
} from './helpers';
import { setupSuccessful } from 'test/testContext';

describe('Execute Cross Chain', () => {
  test.if(setupSuccessful)(
    'should successfully perform cross-chain execution of ETH transfer from spoke airlock to recipient',
    async () => {
      const { eth2Client } = createClients();
      const AMOUNT_TO_TRANSFER_FROM_AIRLOCK = parseEther('0.1');

      // Set up test addresses
      const recipient = '0x1234000000000000000000000000000000000000' as const;
      const airlock = await getSpokeAirlock();

      // Set up initial balances
      await eth2Client.setBalance({
        address: airlock,
        value: AMOUNT_TO_TRANSFER_FROM_AIRLOCK,
      });
      await eth2Client.setBalance({ address: recipient, value: 0n });

      // Get initial balances for verification
      const initialAirlockBalance = await eth2Client.getBalance({
        address: airlock,
      });
      const initialRecipientBalance = await eth2Client.getBalance({
        address: recipient,
      });

      // Create and execute the cross-chain transfer
      const proposalData = createArbitraryProposalDataForSpokeExecution({
        recipient,
        amount: AMOUNT_TO_TRANSFER_FROM_AIRLOCK,
      });
      await createAndExecuteCrossChainProposal(proposalData);

      // Verify the transfer
      const finalAirlockBalance = await eth2Client.getBalance({
        address: airlock,
      });
      const finalRecipientBalance = await eth2Client.getBalance({
        address: recipient,
      });

      expect(initialAirlockBalance - finalAirlockBalance).toBe(
        AMOUNT_TO_TRANSFER_FROM_AIRLOCK,
      );
      expect(finalRecipientBalance - initialRecipientBalance).toBe(
        AMOUNT_TO_TRANSFER_FROM_AIRLOCK,
      );
    },
    100000,
  );
});
