#![deny(unused_must_use)]
#![allow(dead_code)]
#![allow(clippy::upper_case_acronyms)]
#![allow(clippy::result_large_err)]
#![allow(clippy::too_many_arguments)]
// Objects of type Result must be used, otherwise we might
// call a function that returns a Result and not handle the error

use anchor_lang::prelude::*;
use anchor_spl::token::transfer;
use context::*;
use contexts::*;
use state::checkpoints::{find_checkpoint_le, push_checkpoint, Operation};
use state::global_config::GlobalConfig;
use std::convert::TryInto;

use wormhole_solana_consts::{CORE_BRIDGE_PROGRAM_ID, SOLANA_CHAIN};

use anchor_lang::solana_program::{
    instruction::AccountMeta, instruction::Instruction, program::invoke_signed,
};

use wormhole_query_sdk::structs::{
    ChainSpecificQuery, ChainSpecificResponse, EthCallData, QueryResponse,
};

use crate::{
    error::{ErrorCode, ProposalWormholeMessageError, QueriesSolanaVerifyError, VestingError},
    state::GuardianSignatures,
};

// automatically generate module using program idl found in ./idls
declare_program!(wormhole_bridge_core);

mod context;
mod contexts;
mod error;
mod state;
mod utils;
#[cfg(feature = "wasm")]
pub mod wasm;

#[event]
pub struct DelegateChanged {
    pub delegator: Pubkey,
    pub from_delegate: Pubkey,
    pub to_delegate: Pubkey,
    pub total_delegated_votes: u64,
}

#[event]
pub struct VoteCast {
    pub voter: Pubkey,
    pub proposal_id: [u8; 32],
    pub weight: u64,
    pub against_votes: u64,
    pub for_votes: u64,
    pub abstain_votes: u64,
}

#[event]
pub struct ProposalCreated {
    pub proposal_id: [u8; 32],
    pub vote_start: u64,
}

declare_id!("5Vry3MrbhPCBWuviXVgcLQzhQ1mRsVfmQyNFuDgcPUAQ");
#[program]
pub mod staking {
    /// Creates a global config for the program
    use super::*;

    pub fn init_config(ctx: Context<InitConfig>, global_config: GlobalConfig) -> Result<()> {
        let config_account = &mut ctx.accounts.config_account;
        config_account.bump = ctx.bumps.config_account;
        config_account.governance_authority = global_config.governance_authority;
        config_account.wh_token_mint = global_config.wh_token_mint;
        config_account.freeze = global_config.freeze;
        config_account.vesting_admin = global_config.vesting_admin;

        #[cfg(feature = "mock-clock")]
        {
            config_account.mock_clock_time = global_config.mock_clock_time;
        }

        Ok(())
    }

    pub fn update_governance_authority(
        ctx: Context<UpdateGovernanceAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.governance_authority = new_authority;
        Ok(())
    }

    pub fn update_vesting_admin(
        ctx: Context<UpdateVestingAdmin>,
        new_vesting_admin: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.vesting_admin = new_vesting_admin;
        Ok(())
    }

    /// Trustless instruction that creates a stake account for a user
    #[inline(never)]
    pub fn create_stake_account(ctx: Context<CreateStakeAccount>) -> Result<()> {
        let stake_account_metadata = &mut ctx.accounts.stake_account_metadata;
        let owner = &ctx.accounts.payer.key;

        stake_account_metadata.initialize(
            ctx.bumps.stake_account_metadata,
            ctx.bumps.stake_account_custody,
            ctx.bumps.custody_authority,
            &owner,
            &ctx.accounts.stake_account_checkpoints.key(),
        );

        let stake_account_checkpoints = &mut ctx.accounts.stake_account_checkpoints.load_init()?;
        stake_account_checkpoints.initialize(&owner);

        Ok(())
    }

    pub fn delegate(ctx: Context<Delegate>, delegatee: Pubkey) -> Result<()> {
        let stake_account_metadata = &mut ctx.accounts.stake_account_metadata;
        let config = &ctx.accounts.config;

        let prev_recorded_total_balance = stake_account_metadata
            .recorded_balance
            .checked_add(stake_account_metadata.recorded_vesting_balance)
            .unwrap();

        let current_stake_balance = ctx.accounts.stake_account_custody.amount;

        if let Some(vesting_config) = &mut ctx.accounts.vesting_config {
            if vesting_config.finalized {
                if let Some(vesting_balance) = &mut ctx.accounts.vesting_balance {
                    require!(
                        vesting_balance.vester == stake_account_metadata.owner,
                        VestingError::InvalidStakeAccountOwner
                    );
                    require!(
                        vesting_config.mint == config.wh_token_mint,
                        VestingError::InvalidVestingMint
                    );
                    vesting_balance.stake_account_metadata = stake_account_metadata.key();
                    stake_account_metadata.recorded_vesting_balance =
                        vesting_balance.total_vesting_balance;
                }
            }
        }

        let current_delegate = stake_account_metadata.delegate;
        stake_account_metadata.delegate = delegatee;

        let total_delegated_votes = current_stake_balance
            .checked_add(stake_account_metadata.recorded_vesting_balance)
            .unwrap();

        emit!(DelegateChanged {
            delegator: ctx.accounts.stake_account_checkpoints.key(),
            from_delegate: current_delegate,
            to_delegate: delegatee,
            total_delegated_votes: total_delegated_votes
        });

        let current_timestamp: u64 = utils::clock::get_current_time(config).try_into().unwrap();

        if current_delegate != delegatee {
            if prev_recorded_total_balance > 0 {
                let current_delegate_checkpoints_account_info = ctx
                    .accounts
                    .current_delegate_stake_account_checkpoints
                    .to_account_info();

                push_checkpoint(
                    &mut ctx.accounts.current_delegate_stake_account_checkpoints,
                    &current_delegate_checkpoints_account_info,
                    prev_recorded_total_balance,
                    Operation::Subtract,
                    current_timestamp,
                    &ctx.accounts.payer.to_account_info(),
                    &ctx.accounts.system_program.to_account_info(),
                )?;
            }

            if total_delegated_votes > 0 {
                let delegatee_checkpoints_account_info = ctx
                    .accounts
                    .delegatee_stake_account_checkpoints
                    .to_account_info();

                push_checkpoint(
                    &mut ctx.accounts.delegatee_stake_account_checkpoints,
                    &delegatee_checkpoints_account_info,
                    total_delegated_votes,
                    Operation::Add,
                    current_timestamp,
                    &ctx.accounts.payer.to_account_info(),
                    &ctx.accounts.system_program.to_account_info(),
                )?;
            }
        } else if total_delegated_votes != prev_recorded_total_balance {
            let delegatee_checkpoints_account_info = ctx
                .accounts
                .delegatee_stake_account_checkpoints
                .to_account_info();

            let (amount_delta, operation) = if total_delegated_votes > prev_recorded_total_balance {
                (
                    total_delegated_votes
                        .checked_sub(prev_recorded_total_balance)
                        .unwrap(),
                    Operation::Add,
                )
            } else {
                (
                    prev_recorded_total_balance
                        .checked_sub(total_delegated_votes)
                        .unwrap(),
                    Operation::Subtract,
                )
            };

            push_checkpoint(
                &mut ctx.accounts.delegatee_stake_account_checkpoints,
                &delegatee_checkpoints_account_info,
                amount_delta,
                operation,
                current_timestamp,
                &ctx.accounts.payer.to_account_info(),
                &ctx.accounts.system_program.to_account_info(),
            )?;
        }

        if current_stake_balance != stake_account_metadata.recorded_balance {
            stake_account_metadata.recorded_balance = current_stake_balance;
        }

        Ok(())
    }

    pub fn withdraw_tokens(ctx: Context<WithdrawTokens>, amount: u64) -> Result<()> {
        let stake_account_metadata = &ctx.accounts.stake_account_metadata;

        let destination_account = &ctx.accounts.destination;
        let signer = &ctx.accounts.payer;

        if destination_account.owner != *signer.key {
            return Err(error!(ErrorCode::WithdrawToUnauthorizedAccount));
        }

        transfer(
            CpiContext::from(&*ctx.accounts).with_signer(&[&[
                AUTHORITY_SEED.as_bytes(),
                ctx.accounts.stake_account_checkpoints.key().as_ref(),
                &[stake_account_metadata.authority_bump],
            ]]),
            amount,
        )?;

        ctx.accounts.stake_account_custody.reload()?;

        let recorded_balance = &stake_account_metadata.recorded_balance;
        let current_stake_balance = &ctx.accounts.stake_account_custody.amount;

        if stake_account_metadata.delegate != Pubkey::default() {
            let current_delegate_account_info = ctx
                .accounts
                .current_delegate_stake_account_checkpoints
                .to_account_info();
            let config = &ctx.accounts.config;
            let current_timestamp: u64 = utils::clock::get_current_time(config).try_into().unwrap();

            let (amount_delta, operation) = if current_stake_balance > recorded_balance {
                (current_stake_balance - recorded_balance, Operation::Add)
            } else {
                (
                    recorded_balance - current_stake_balance,
                    Operation::Subtract,
                )
            };

            push_checkpoint(
                &mut ctx.accounts.current_delegate_stake_account_checkpoints,
                &current_delegate_account_info,
                amount_delta,
                operation,
                current_timestamp,
                &ctx.accounts.payer.to_account_info(),
                &ctx.accounts.system_program.to_account_info(),
            )?;
        }

        ctx.accounts.stake_account_metadata.recorded_balance = *current_stake_balance;

        Ok(())
    }

    pub fn cast_vote(
        ctx: Context<CastVote>,
        proposal_id: [u8; 32],
        against_votes: u64,
        for_votes: u64,
        abstain_votes: u64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        let voter_checkpoints = ctx.accounts.voter_checkpoints.to_account_info();

        if let Some(checkpoint) = find_checkpoint_le(&voter_checkpoints, proposal.vote_start)? {
            let total_weight = checkpoint.value;

            require!(total_weight > 0, ErrorCode::NoWeight);

            let proposal_voters_weight_cast = &mut ctx.accounts.proposal_voters_weight_cast;

            // Initialize proposal_voters_weight_cast if it hasn't been initialized yet
            if proposal_voters_weight_cast.value == 0 {
                proposal_voters_weight_cast.initialize(proposal_id, &ctx.accounts.owner.key());
            }

            require!(
                proposal_voters_weight_cast.value <= total_weight,
                ErrorCode::AllWeightCast
            );

            let new_weight =
                against_votes + for_votes + abstain_votes + proposal_voters_weight_cast.value;

            require!(new_weight <= total_weight, ErrorCode::VoteWouldExceedWeight);

            proposal_voters_weight_cast.set(new_weight);

            proposal.against_votes += against_votes;
            proposal.for_votes += for_votes;
            proposal.abstain_votes += abstain_votes;

            emit!(VoteCast {
                voter: ctx.accounts.voter_checkpoints.key(),
                proposal_id,
                weight: total_weight,
                against_votes,
                for_votes,
                abstain_votes
            });
        } else {
            return Err(error!(ErrorCode::CheckpointNotFound));
        }

        Ok(())
    }

    //------------------------------------ VESTING ------------------------------------------------
    // Initialize a new Config, setting up a mint, vault and admin
    pub fn initialize_vesting_config(ctx: Context<Initialize>, seed: u64) -> Result<()> {
        ctx.accounts.initialize(seed, ctx.bumps.config)
    }

    // Create a vesting balance account
    pub fn create_vesting_balance(ctx: Context<CreateVestingBalance>) -> Result<()> {
        ctx.accounts
            .create_vesting_balance(ctx.bumps.vesting_balance)
    }

    // Finalize a Config, disabling any further creation or cancellation of Vesting accounts
    pub fn finalize_vesting_config(ctx: Context<Finalize>) -> Result<()> {
        ctx.accounts.finalize()
    }

    // Open a new Vesting account and deposit equivalent vested tokens to vault
    pub fn create_vesting(ctx: Context<CreateVesting>, maturation: i64, amount: u64) -> Result<()> {
        ctx.accounts
            .create_vesting(maturation, amount, ctx.bumps.vest)
    }

    // Claim from and close a Vesting account
    pub fn claim_vesting(ctx: Context<ClaimVesting>) -> Result<()> {
        ctx.accounts.close_vesting()
    }

    // Cancel and close a Vesting account for a non-finalized Config
    pub fn cancel_vesting(ctx: Context<CancelVesting>) -> Result<()> {
        ctx.accounts.cancel_vesting()
    }

    // Allow admin to withdraw surplus tokens in excess of total vested amount
    pub fn withdraw_surplus(ctx: Context<WithdrawSurplus>) -> Result<()> {
        ctx.accounts.withdraw_surplus()
    }

    //------------------------------------ SPOKE MESSAGE EXECUTOR ------------------------------------------------
    // Initialize and setting a spoke message executor
    pub fn initialize_spoke_message_executor(
        ctx: Context<InitializeSpokeMessageExecutor>,
        hub_chain_id: u16,
    ) -> Result<()> {
        let executor = &mut ctx.accounts.executor;
        executor.bump = ctx.bumps.executor;
        executor.hub_dispatcher = ctx.accounts.hub_dispatcher.key();
        executor.hub_chain_id = hub_chain_id;
        executor.spoke_chain_id = SOLANA_CHAIN;
        executor.wormhole_core = CORE_BRIDGE_PROGRAM_ID;
        executor.airlock = ctx.accounts.airlock.key();
        Ok(())
    }

    pub fn set_message_received(
        ctx: Context<SetMessageReceived>,
        _message_hash: [u8; 32],
    ) -> Result<()> {
        let message_received = &mut ctx.accounts.message_received;
        message_received.executed = true;
        Ok(())
    }

    pub fn set_airlock(ctx: Context<SetAirlock>) -> Result<()> {
        let executor = &mut ctx.accounts.executor;

        require!(
            ctx.accounts.payer.key() == executor.airlock,
            ErrorCode::InvalidSpokeAirlock
        );

        executor.airlock = ctx.accounts.airlock.key();
        Ok(())
    }

    //------------------------------------ SPOKE AIRLOCK ------------------------------------------------
    pub fn initialize_spoke_airlock(
        ctx: Context<InitializeSpokeAirlock>,
        message_executor: Pubkey,
    ) -> Result<()> {
        let airlock = &mut ctx.accounts.airlock;
        airlock.bump = ctx.bumps.airlock;
        airlock.message_executor = message_executor;
        Ok(())
    }

    pub fn execute_operation<'info>(
        ctx: Context<'_, '_, '_, 'info, ExecuteOperation<'info>>,
        cpi_target_program_id: Pubkey,
        instruction_data: Vec<u8>,
        _value: u64,
    ) -> Result<()> {
        let airlock = &ctx.accounts.airlock;
        require!(
            ctx.accounts.payer.key() == airlock.message_executor,
            ErrorCode::InvalidMessageExecutor
        );

        let mut all_account_infos = ctx.accounts.to_account_infos();
        all_account_infos.extend_from_slice(ctx.remaining_accounts);

        let account_metas = all_account_infos
            .clone()
            .into_iter()
            .map(|account| AccountMeta::new(*account.key, false))
            .collect();

        let instruction = Instruction {
            program_id: cpi_target_program_id,
            accounts: account_metas,
            data: instruction_data,
        };

        let signer_seeds: &[&[&[u8]]] = &[&[b"airlock", &[airlock.bump]]];

        invoke_signed(&instruction, &all_account_infos, signer_seeds)?;

        Ok(())
    }

    //------------------------------------ SPOKE METADATA COLLECTOR ------------------------------------------------
    // Initialize and setting a spoke metadata collector
    pub fn initialize_spoke_metadata_collector(
        ctx: Context<InitializeSpokeMetadataCollector>,
        hub_chain_id: u16,
        hub_proposal_metadata: [u8; 20],
    ) -> Result<()> {
        let spoke_metadata_collector = &mut ctx.accounts.spoke_metadata_collector;
        let _ = spoke_metadata_collector.initialize(
            ctx.bumps.spoke_metadata_collector,
            hub_chain_id,
            hub_proposal_metadata,
            CORE_BRIDGE_PROGRAM_ID,
        );

        Ok(())
    }

    pub fn post_signatures(
        ctx: Context<PostSignatures>,
        guardian_signatures: Vec<[u8; 66]>,
        total_signatures: u8,
    ) -> Result<()> {
        _post_signatures(ctx, guardian_signatures, total_signatures)
    }

    /// Allows the initial payer to close the signature account in case the query was invalid.
    pub fn close_signatures(_ctx: Context<CloseSignatures>) -> Result<()> {
        Ok(())
    }

    #[access_control(AddProposal::constraints(&ctx, &bytes))]
    pub fn add_proposal(
        ctx: Context<AddProposal>,
        bytes: Vec<u8>,
        proposal_id: [u8; 32],
        _guardian_set_index: u32,
    ) -> Result<()> {
        let response = QueryResponse::deserialize(&bytes)
            .map_err(|_| QueriesSolanaVerifyError::FailedToParseResponse)?;

        require!(
            response.responses.len() == 1,
            ProposalWormholeMessageError::TooManyQueryResponses
        );

        let spoke_metadata_collector = &mut ctx.accounts.spoke_metadata_collector;

        if let ChainSpecificQuery::EthCallWithFinalityQueryRequest(eth_request) =
            &response.request.requests[0].query
        {
            require!(
                eth_request.finality == "finalized",
                ProposalWormholeMessageError::NonFinalizedBlock
            );

            let EthCallData { to, data } = &eth_request.call_data[0];

            require!(
                *to == spoke_metadata_collector.hub_proposal_metadata,
                ProposalWormholeMessageError::InvalidHubProposalMetadataContract
            );

            let proposal_query_request_data =
                spoke_metadata_collector.parse_proposal_query_request_data(&data)?;

            // The function signature should be bytes4(keccak256(bytes("getProposalMetadata(uint256)")))
            require!(
                proposal_query_request_data.signature == [0xeb, 0x9b, 0x98, 0x38],
                ProposalWormholeMessageError::InvalidFunctionSignature
            );
        } else {
            return Err(ProposalWormholeMessageError::InvalidChainSpecificQuery.into());
        }

        let response = &response.responses[0];

        require!(
            response.chain_id == spoke_metadata_collector.hub_chain_id,
            ProposalWormholeMessageError::SenderChainMismatch
        );

        if let ChainSpecificResponse::EthCallWithFinalityQueryResponse(eth_response) =
            &response.response
        {
            require!(
                eth_response.results.len() == 1,
                ProposalWormholeMessageError::TooManyEthCallResults
            );

            let proposal_data = spoke_metadata_collector
                .parse_eth_response_proposal_data(&eth_response.results[0])?;

            require!(
                proposal_data.proposal_id == proposal_id,
                ProposalWormholeMessageError::InvalidProposalId
            );

            let proposal = &mut ctx.accounts.proposal;

            require!(
                proposal_data.vote_start != 0,
                ProposalWormholeMessageError::ProposalNotInitialized
            );

            let _ = proposal.add_proposal(proposal_data.proposal_id, proposal_data.vote_start);

            emit!(ProposalCreated {
                proposal_id: proposal_data.proposal_id,
                vote_start: proposal_data.vote_start
            });
        } else {
            return Err(ProposalWormholeMessageError::InvalidChainSpecificResponse.into());
        }

        Ok(())
    }
}

/// Creates or appends to a GuardianSignatures account for subsequent use by verify_query.
/// This is necessary as the Wormhole query response (220 bytes)
/// and 13 guardian signatures (a quorum of the current 19 mainnet guardians, 66 bytes each)
/// alongside the required accounts is larger than the transaction size limit on Solana (1232 bytes).
///
/// This instruction allows for the initial payer to append additional signatures to the account by calling the instruction again.
/// This may be necessary if a quorum of signatures from the current guardian set grows larger than can fit into a single transaction.
///
/// The GuardianSignatures account can be closed by anyone with a successful update_root_with_query instruction
/// or by the initial payer via close_signatures, either of which will refund the initial payer.
fn _post_signatures(
    ctx: Context<PostSignatures>,
    mut guardian_signatures: Vec<[u8; 66]>,
    _total_signatures: u8,
) -> Result<()> {
    if ctx.accounts.guardian_signatures.is_initialized() {
        require_eq!(
            ctx.accounts.guardian_signatures.refund_recipient,
            ctx.accounts.payer.key(),
            QueriesSolanaVerifyError::WriteAuthorityMismatch
        );
        ctx.accounts
            .guardian_signatures
            .guardian_signatures
            .append(&mut guardian_signatures);
    } else {
        ctx.accounts
            .guardian_signatures
            .set_inner(GuardianSignatures {
                refund_recipient: ctx.accounts.payer.key(),
                guardian_signatures,
            });
    }

    Ok(())
}
