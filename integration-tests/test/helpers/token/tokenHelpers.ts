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
  const { ethWallet, eth2Wallet, account } = createClients();
  const client = isHub ? ethWallet : eth2Wallet;
  const chain = isHub ? ethWallet.chain : eth2Wallet.chain;

  const hash = await client.writeContract({
    address: ContractAddresses.TOKEN,
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
  console.log(
    `Minted ${amount} tokens for account ${recipientAddress} on chain ${chain.name}. Transaction hash: ${hash}`,
  );
  return hash;
};

export const delegate = async ({
  delegatee,
  isHub,
}: {
  delegatee: Address;
  isHub: boolean;
}) => {
  const { ethWallet, eth2Wallet, account } = createClients();
  const client = isHub ? ethWallet : eth2Wallet;
  const chain = isHub ? ethWallet.chain : eth2Wallet.chain;

  const hash = await client.writeContract({
    address: ContractAddresses.TOKEN,
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
  console.log(
    `Delegated votes from ${account.address} to ${delegatee} on chain ${ethWallet.chain?.name}. Transaction hash: ${hash}`,
  );
  return hash;
};
