import type { Address, PublicClient } from 'viem';
import { erc20Abi } from 'viem';
import { ContractAddresses } from '../../config/addresses';
import { createClients } from '../../config/clients';

export const getVotingTokenBalance = async ({
  account,
  client,
  tokenAddress,
}: {
  account: Address;
  client: PublicClient;
  tokenAddress: Address;
}) =>
  await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  });

export const mintTokens = async ({
  recipientAddress,
  amount,
  isHub,
}: {
  recipientAddress: Address;
  amount: bigint;
  isHub: boolean;
}) => {
  console.log(
    `\n💰 Minting ${amount} tokens for ${recipientAddress} on ${isHub ? 'hub' : 'spoke'} chain`,
  );
  const { ethWallet, eth2Wallet, account } = createClients();
  const client = isHub ? ethWallet : eth2Wallet;
  const chain = isHub ? ethWallet.chain : eth2Wallet.chain;
  const tokenAddress = isHub
    ? ContractAddresses.HUB_VOTING_TOKEN
    : ContractAddresses.SPOKE_VOTING_TOKEN;

  const hash = await client.writeContract({
    address: tokenAddress,
    abi: [
      {
        name: 'mint',
        type: 'function',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
      },
    ],
    functionName: 'mint',
    args: [recipientAddress, amount],
    account,
    chain,
  });

  await client.waitForTransactionReceipt({ hash });
  console.log('✅ Tokens minted successfully');
  return hash;
};

export const delegate = async ({
  delegatee,
  isHub,
}: {
  delegatee: Address;
  isHub: boolean;
}) => {
  console.log(
    `\n📊 Delegating votes to ${delegatee} on ${isHub ? 'hub' : 'spoke'} chain`,
  );
  const { ethWallet, eth2Wallet, account } = createClients();
  const client = isHub ? ethWallet : eth2Wallet;
  const chain = isHub ? ethWallet.chain : eth2Wallet.chain;
  const tokenAddress = isHub
    ? ContractAddresses.HUB_VOTING_TOKEN
    : ContractAddresses.SPOKE_VOTING_TOKEN;

  const hash = await client.writeContract({
    address: tokenAddress,
    abi: [
      {
        name: 'delegate',
        type: 'function',
        inputs: [{ name: 'delegatee', type: 'address' }],
        outputs: [],
      },
    ],
    functionName: 'delegate',
    args: [delegatee],
    account,
    chain,
  });

  await client.waitForTransactionReceipt({ hash });
  console.log('✅ Delegation complete');
  return hash;
};
