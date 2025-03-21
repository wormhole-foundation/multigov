use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_memory::sol_memcpy;
use anchor_lang::solana_program::secp256k1_recover::secp256k1_recover;
use anchor_lang::solana_program::{self, keccak};
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};

use wormhole_solana_consts::CORE_BRIDGE_PROGRAM_ID;

use crate::error::{ErrorCode, QueriesSolanaVerifyError};
use crate::state::{GuardianSignatures, WormholeGuardianSet};
use anchor_lang::prelude::Clock;
use wormhole_anchor_sdk::wormhole::PostedVaa;
use wormhole_query_sdk::{MESSAGE_PREFIX, QUERY_MESSAGE_LEN};

use crate::utils::execute_message::Message;
use crate::MessageExecutorError;
use wormhole_raw_vaas::utils::quorum;
use wormhole_raw_vaas::GuardianSetSig;

pub const AUTHORITY_SEED: &str = "authority";
pub const CUSTODY_SEED: &str = "custody";
pub const STAKE_ACCOUNT_METADATA_SEED: &str = "stake_metadata";
pub const CHECKPOINT_DATA_SEED: &str = "owner";
pub const CONFIG_SEED: &str = "config";
pub const PROPOSAL_SEED: &str = "proposal";
pub const VESTING_CONFIG_SEED: &str = "vesting_config";
pub const VEST_SEED: &str = "vest";
pub const VESTING_BALANCE_SEED: &str = "vesting_balance";
pub const SPOKE_MESSAGE_EXECUTOR_SEED: &str = "spoke_message_executor";
pub const MESSAGE_RECEIVED: &str = "message_received";
pub const AIRLOCK_SEED: &str = "airlock";
pub const SPOKE_METADATA_COLLECTOR_SEED: &str = "spoke_metadata_collector";
pub const VOTE_WEIGHT_WINDOW_LENGTHS_SEED: &str = "vote_weight_window_lengths";
pub const GUARDIAN_SIGNATURES_SEED: &str = "guardian_signatures";

#[derive(Accounts)]
pub struct InitConfig<'info> {
    // Native payer
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = global_config::GlobalConfig::LEN,
        seeds = [CONFIG_SEED.as_bytes()],
        bump
    )]
    pub config_account: Account<'info, global_config::GlobalConfig>,

    // Primitive accounts
    pub system_program: Program<'info, System>,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(delegatee: Pubkey, current_delegate_stake_account_owner: Pubkey)]
pub struct Delegate<'info> {
    // Native payer
    #[account(address = stake_account_metadata.owner)]
    pub payer: Signer<'info>,

    // Current delegate stake account
    #[account(
        mut,
        seeds = [
            CHECKPOINT_DATA_SEED.as_bytes(),
            stake_account_metadata.delegate.as_ref(),
            current_delegate_stake_account_metadata.stake_account_checkpoints_last_index.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub current_delegate_stake_account_checkpoints:
        AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), current_delegate_stake_account_owner.as_ref()],
        bump = current_delegate_stake_account_metadata.metadata_bump
    )]
    pub current_delegate_stake_account_metadata:
        Box<Account<'info, stake_account::StakeAccountMetadata>>,

    // Delegatee stake account
    #[account(
        mut,
        seeds = [
            CHECKPOINT_DATA_SEED.as_bytes(),
            delegatee.as_ref(),
            delegatee_stake_account_metadata.stake_account_checkpoints_last_index.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub delegatee_stake_account_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), delegatee.as_ref()],
        bump = delegatee_stake_account_metadata.metadata_bump
    )]
    pub delegatee_stake_account_metadata: Box<Account<'info, stake_account::StakeAccountMetadata>>,

    // User stake account
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), payer.key().as_ref()],
        bump = stake_account_metadata.metadata_bump,
        constraint = stake_account_metadata.delegate == current_delegate_stake_account_owner
            @ ErrorCode::InvalidCurrentDelegate
    )]
    pub stake_account_metadata: Box<Account<'info, stake_account::StakeAccountMetadata>>,

    /// CHECK : This AccountInfo is safe because it's a checked PDA
    #[account(seeds = [AUTHORITY_SEED.as_bytes(), payer.key().as_ref()], bump)]
    pub custody_authority: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [
            CUSTODY_SEED.as_bytes(),
            payer.key().as_ref()
        ],
        bump,
        token::mint = mint,
        token::authority = custody_authority,
    )]
    pub stake_account_custody: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub vesting_config: Option<Account<'info, VestingConfig>>,
    #[account(mut)]
    pub vesting_balance: Option<Account<'info, VestingBalance>>,

    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Box<Account<'info, global_config::GlobalConfig>>,
    // Wormhole token mint:
    #[account(address = config.voting_token_mint)]
    pub mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(proposal_id: [u8; 32],
        _against_votes: u64,
        _for_votes: u64,
        _abstain_votes: u64,
        stake_account_checkpoints_index: u16)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [PROPOSAL_SEED.as_bytes(), &proposal_id],
        bump
    )]
    pub proposal: Account<'info, proposal::ProposalData>,

    /// CheckpointData account that contains the checkpoint for the timestamp vote_start - vote_weight_window_length
    #[account(
        mut,
        has_one = owner,
        seeds = [CHECKPOINT_DATA_SEED.as_bytes(), owner.key().as_ref(), stake_account_checkpoints_index.to_le_bytes().as_ref()],
        bump
    )]
    pub voter_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,

    /// Next CheckpointData account if it exists
    /// Necessary for handle the case when the vote window contains checkpoints stored on two accounts
    pub voter_checkpoints_next: Option<AccountLoader<'info, checkpoints::CheckpointData>>,

    #[account(
        init_if_needed,
        payer = owner,
        space = proposal_voters_weight_cast::ProposalVotersWeightCast::LEN,
        seeds = [b"proposal_voters_weight_cast", proposal.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub proposal_voters_weight_cast:
        Account<'info, proposal_voters_weight_cast::ProposalVotersWeightCast>,

    #[account(
        mut,
        seeds = [VOTE_WEIGHT_WINDOW_LENGTHS_SEED.as_bytes()],
        bump
    )]
    pub vote_weight_window_lengths: AccountLoader<'info, VoteWeightWindowLengths>,

    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Box<Account<'info, global_config::GlobalConfig>>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeSpokeMetadataCollector<'info> {
    #[account(mut, address = config.governance_authority)]
    pub governance_authority: Signer<'info>,

    #[account(
        init,
        payer = governance_authority,
        space = SpokeMetadataCollector::LEN,
        seeds = [SPOKE_METADATA_COLLECTOR_SEED.as_bytes()],
        bump
    )]
    pub spoke_metadata_collector: Account<'info, SpokeMetadataCollector>,

    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Box<Account<'info, global_config::GlobalConfig>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateHubProposalMetadata<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [AIRLOCK_SEED.as_bytes()],
        bump = airlock.bump,
    )]
    pub airlock: Account<'info, SpokeAirlock>,

    #[account(
        mut,
        seeds = [SPOKE_METADATA_COLLECTOR_SEED.as_bytes()],
        bump = spoke_metadata_collector.bump
    )]
    pub spoke_metadata_collector: Account<'info, SpokeMetadataCollector>,

    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Box<Account<'info, global_config::GlobalConfig>>,
}

#[derive(Accounts)]
pub struct RelinquishAdminControlOverHubProposalMetadata<'info> {
    #[account(mut, address = config.governance_authority)]
    pub governance_authority: Signer<'info>,

    #[account(
        mut,
        seeds = [SPOKE_METADATA_COLLECTOR_SEED.as_bytes()],
        bump = spoke_metadata_collector.bump
    )]
    pub spoke_metadata_collector: Account<'info, SpokeMetadataCollector>,

    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Box<Account<'info, global_config::GlobalConfig>>,
}

#[derive(Accounts)]
#[instruction(_guardian_signatures: Vec<[u8; 66]>, total_signatures: u8, random_seed: [u8; 32])]
pub struct PostSignatures<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + GuardianSignatures::compute_size(usize::from(total_signatures)),
        seeds = [GUARDIAN_SIGNATURES_SEED.as_bytes(), payer.key().as_ref(), random_seed.as_ref()],
        bump
    )]
    pub guardian_signatures: Account<'info, GuardianSignatures>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseSignatures<'info> {
    #[account(mut, has_one = refund_recipient, close = refund_recipient)]
    pub guardian_signatures: Account<'info, GuardianSignatures>,

    #[account(mut, address = guardian_signatures.refund_recipient)]
    pub refund_recipient: Signer<'info>,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(_bytes: Vec<u8>, proposal_id : [u8; 32], guardian_set_index: u32)]
pub struct AddProposal<'info> {
    /// Guardian set used for signature verification.
    #[account(
        seeds = [
            WormholeGuardianSet::SEED_PREFIX,
            guardian_set_index.to_be_bytes().as_ref()
        ],
        bump,
        seeds::program = CORE_BRIDGE_PROGRAM_ID
    )]
    pub guardian_set: Account<'info, WormholeGuardianSet>,

    /// Stores unverified guardian signatures as they are too large to fit in the instruction data.
    #[account(mut, has_one = refund_recipient, close = refund_recipient)]
    pub guardian_signatures: Account<'info, GuardianSignatures>,

    /// CHECK: This account is the refund recipient for the above signature_set
    #[account(mut, address = guardian_signatures.refund_recipient)]
    pub refund_recipient: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = proposal::ProposalData::LEN,
        seeds = [PROPOSAL_SEED.as_bytes(), &proposal_id],
        bump
    )]
    pub proposal: Account<'info, proposal::ProposalData>,

    #[account(
        mut,
        seeds = [SPOKE_METADATA_COLLECTOR_SEED.as_bytes()],
        bump = spoke_metadata_collector.bump
    )]
    pub spoke_metadata_collector: Account<'info, SpokeMetadataCollector>,

    pub system_program: Program<'info, System>,
}

impl<'info> AddProposal<'info> {
    pub fn constraints(ctx: &Context<Self>, bytes: &Vec<u8>) -> Result<()> {
        let guardian_set = &ctx.accounts.guardian_set;

        // Check that the guardian set is still active.
        let timestamp = Clock::get()?
            .unix_timestamp
            .try_into()
            .expect("timestamp overflow");
        require!(
            guardian_set.is_active(&timestamp),
            QueriesSolanaVerifyError::GuardianSetExpired
        );

        // Compute the message hash.
        let message_hash = [
            MESSAGE_PREFIX,
            &solana_program::keccak::hashv(&[bytes]).to_bytes(),
        ]
        .concat();

        // SECURITY: defense-in-depth, check again that these are the expected length
        require_eq!(
            message_hash.len(),
            QUERY_MESSAGE_LEN,
            QueriesSolanaVerifyError::InvalidMessageHash
        );

        let guardian_signatures = &ctx.accounts.guardian_signatures.guardian_signatures;

        // This section is borrowed from https://github.com/wormhole-foundation/wormhole/blob/wen/solana-rewrite/solana/programs/core-bridge/src/processor/parse_and_verify_vaa/verify_encoded_vaa_v1.rs#L72-L103
        // Also similarly used here https://github.com/pyth-network/pyth-crosschain/blob/6771c2c6998f53effee9247347cb0ac71612b3dc/target_chains/solana/programs/pyth-solana-receiver/src/lib.rs#L121-L159
        // Do we have enough signatures for quorum?
        let guardian_keys = &guardian_set.keys;
        let quorum = quorum(guardian_keys.len());
        require!(
            guardian_signatures.len() >= quorum,
            QueriesSolanaVerifyError::NoQuorum
        );

        let digest = keccak::hash(message_hash.as_slice());

        // Verify signatures
        let mut last_guardian_index = None;
        for sig_bytes in guardian_signatures {
            let sig = GuardianSetSig::try_from(sig_bytes.as_slice())
                .map_err(|_| QueriesSolanaVerifyError::InvalidSignature)?;
            // We do not allow for non-increasing guardian signature indices.
            let index = usize::from(sig.guardian_index());
            if let Some(last_index) = last_guardian_index {
                require!(
                    index > last_index,
                    QueriesSolanaVerifyError::InvalidGuardianIndexNonIncreasing
                );
            }

            // Does this guardian index exist in this guardian set?
            let guardian_pubkey = guardian_keys
                .get(index)
                .ok_or_else(|| error!(QueriesSolanaVerifyError::InvalidGuardianIndexOutOfRange))?;

            // Now verify that the signature agrees with the expected Guardian's pubkey.
            verify_guardian_signature(&sig, guardian_pubkey, digest.as_ref())?;

            last_guardian_index = Some(index);
        }
        // End borrowed section

        // Done.
        Ok(())
    }
}

/**
 * Borrowed from https://github.com/wormhole-foundation/wormhole/blob/wen/solana-rewrite/solana/programs/core-bridge/src/processor/parse_and_verify_vaa/verify_encoded_vaa_v1.rs#L121
 * Also used here https://github.com/pyth-network/pyth-crosschain/blob/6771c2c6998f53effee9247347cb0ac71612b3dc/target_chains/solana/programs/pyth-solana-receiver/src/lib.rs#L432
 */
fn verify_guardian_signature(
    sig: &GuardianSetSig,
    guardian_pubkey: &[u8; 20],
    digest: &[u8],
) -> Result<()> {
    // Recover using `solana_program::secp256k1_recover`. Public key recovery costs 25k compute
    // units. And hashing this public key to recover the Ethereum public key costs about 13k.
    let recovered = {
        // Recover EC public key (64 bytes).
        let pubkey = secp256k1_recover(digest, sig.recovery_id(), &sig.rs())
            .map_err(|_| QueriesSolanaVerifyError::InvalidSignature)?;

        // The Ethereum public key is the last 20 bytes of keccak hashed public key above.
        let hashed = keccak::hash(&pubkey.to_bytes());

        let mut eth_pubkey = [0; 20];
        sol_memcpy(&mut eth_pubkey, &hashed.0[12..], 20);

        eth_pubkey
    };

    // The recovered public key should agree with the Guardian's public key at this index.
    require!(
        recovered == *guardian_pubkey,
        QueriesSolanaVerifyError::InvalidGuardianKeyRecovery
    );

    // Done.
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateGovernanceAuthority<'info> {
    #[account(address = config.governance_authority)]
    pub governance_signer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Account<'info, global_config::GlobalConfig>,
    /// CHECK: This account will be the signer in the [claim_governance_authority] instruction.
    pub new_authority: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ClaimGovernanceAuthority<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED.as_bytes()],
        bump = config.bump,
        constraint = (
            config.pending_governance_authority == Some(new_authority.key())
            || config.governance_authority == new_authority.key()
        ) @ ErrorCode::InvalidPendingAuthority
    )]
    pub config: Account<'info, global_config::GlobalConfig>,
    pub new_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateVestingAdmin<'info> {
    #[account(address = config.vesting_admin)]
    pub vesting_admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Account<'info, global_config::GlobalConfig>,
    /// CHECK: This account will be the signer in the [claim_vesting_admin] instruction.
    pub new_vesting_admin: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ClaimVestingAdmin<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED.as_bytes()],
        bump = config.bump,
        constraint = (
            config.pending_vesting_admin == Some(new_vesting_admin.key())
            || config.vesting_admin == new_vesting_admin.key()
        ) @ ErrorCode::InvalidPendingAuthority
    )]
    pub config: Account<'info, global_config::GlobalConfig>,
    pub new_vesting_admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateStakeAccount<'info> {
    // Native payer:
    #[account(mut)]
    pub payer: Signer<'info>,

    // Stake program accounts:
    #[account(
        init,
        seeds = [CHECKPOINT_DATA_SEED.as_bytes(), payer.key().as_ref(), 0u16.to_le_bytes().as_ref()],
        bump,
        payer = payer,
        space = checkpoints::CheckpointData::LEN,
    )]
    pub stake_account_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(
        init,
        payer = payer,
        space = stake_account::StakeAccountMetadata::LEN,
        seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), payer.key().as_ref()],
        bump
    )]
    pub stake_account_metadata: Box<Account<'info, stake_account::StakeAccountMetadata>>,
    /// CHECK : This AccountInfo is safe because it's a checked PDA
    #[account(seeds = [AUTHORITY_SEED.as_bytes(), payer.key().as_ref()], bump)]
    pub custody_authority: AccountInfo<'info>,
    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Box<Account<'info, global_config::GlobalConfig>>,
    // Wormhole token mint:
    #[account(address = config.voting_token_mint)]
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        seeds = [
            CUSTODY_SEED.as_bytes(),
            payer.key().as_ref()
        ],
        bump,
        payer = payer,
        token::mint = mint,
        token::authority = custody_authority,
    )]
    pub stake_account_custody: Box<Account<'info, TokenAccount>>,
    // Primitive accounts :
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct CreateCheckpoints<'info> {
    // Native payer:
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [CHECKPOINT_DATA_SEED.as_bytes(), stake_account_metadata.owner.as_ref(), (stake_account_metadata.stake_account_checkpoints_last_index - 1).to_le_bytes().as_ref()],
        bump
    )]
    pub stake_account_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(
        init,
        payer = payer,
        space = checkpoints::CheckpointData::LEN,
        seeds = [CHECKPOINT_DATA_SEED.as_bytes(), stake_account_metadata.owner.as_ref(), stake_account_metadata.stake_account_checkpoints_last_index.to_le_bytes().as_ref()],
        bump
    )]
    pub new_stake_account_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(mut)]
    pub stake_account_metadata: Box<Account<'info, stake_account::StakeAccountMetadata>>,

    // Primitive accounts :
    pub system_program: Program<'info, System>,
}

#[event_cpi]
#[derive(Accounts)]
#[instruction(amount: u64, _current_delegate_stake_account_metadata_owner: Pubkey, _stake_account_metadata_owner: Pubkey
)]
pub struct WithdrawTokens<'info> {
    // Native payer:
    #[account(mut, address = stake_account_metadata.owner)]
    pub payer: Signer<'info>,

    // Current delegate stake account:
    #[account(
        mut,
        seeds = [
            CHECKPOINT_DATA_SEED.as_bytes(),
            stake_account_metadata.delegate.as_ref(),
            current_delegate_stake_account_metadata.stake_account_checkpoints_last_index.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub current_delegate_stake_account_checkpoints:
        AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), _current_delegate_stake_account_metadata_owner.as_ref()],
        bump = current_delegate_stake_account_metadata.metadata_bump
    )]
    pub current_delegate_stake_account_metadata:
        Box<Account<'info, stake_account::StakeAccountMetadata>>,

    // Destination
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    // Stake program accounts:
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), _stake_account_metadata_owner.as_ref()],
        bump = stake_account_metadata.metadata_bump,
        constraint = stake_account_metadata.delegate == _current_delegate_stake_account_metadata_owner
            @ ErrorCode::InvalidCurrentDelegate
    )]
    pub stake_account_metadata: Box<Account<'info, stake_account::StakeAccountMetadata>>,
    #[account(
        mut,
        seeds = [CUSTODY_SEED.as_bytes(), payer.key().as_ref()],
        bump = stake_account_metadata.custody_bump,
    )]
    pub stake_account_custody: Account<'info, TokenAccount>,
    /// CHECK : This AccountInfo is safe because it's a checked PDA
    #[account(seeds = [AUTHORITY_SEED.as_bytes(), payer.key().as_ref()], bump = stake_account_metadata.authority_bump
    )]
    pub custody_authority: AccountInfo<'info>,
    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Account<'info, global_config::GlobalConfig>,
    // Primitive accounts :
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

impl<'a, 'b, 'c, 'info> From<&WithdrawTokens<'info>>
    for CpiContext<'a, 'b, 'c, 'info, Transfer<'info>>
{
    fn from(accounts: &WithdrawTokens<'info>) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: accounts.stake_account_custody.to_account_info(),
            to: accounts.destination.to_account_info(),
            authority: accounts.custody_authority.to_account_info(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct InitializeSpokeMessageExecutor<'info> {
    #[account(mut, address = config.governance_authority)]
    pub governance_authority: Signer<'info>,

    #[account(
        init,
        payer = governance_authority,
        space = SpokeMessageExecutor::LEN,
        seeds = [SPOKE_MESSAGE_EXECUTOR_SEED.as_bytes()],
        bump
    )]
    pub executor: Account<'info, SpokeMessageExecutor>,
    /// CHECK: `hub_dispatcher` is safe to use
    pub hub_dispatcher: AccountInfo<'info>,
    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Box<Account<'info, global_config::GlobalConfig>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReceiveMessage<'info> {
    /// The payer of the transaction fees
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Stores the state of the message execution to prevent re-execution
    #[account(
        init,
        space = MessageReceived::LEN,
        payer = payer,
        seeds = [
            MESSAGE_RECEIVED.as_bytes(),
            posted_vaa.emitter_chain().to_be_bytes().as_ref(),
            posted_vaa.emitter_address().as_ref(),
            posted_vaa.sequence().to_be_bytes().as_ref()
        ],
        bump
    )]
    pub message_received: Box<Account<'info, MessageReceived>>,

    /// The verified Wormhole VAA account containing the message
    #[account(
        constraint = posted_vaa.emitter_chain() == message_executor.hub_chain_id @ MessageExecutorError::InvalidEmitterChain,
        constraint = *posted_vaa.emitter_address() == message_executor.hub_dispatcher.to_bytes() @ MessageExecutorError::InvalidHubDispatcher,
    )]
    pub posted_vaa: Account<'info, PostedVaa::<Message>>,

    #[account(
        seeds = [AIRLOCK_SEED.as_bytes()],
        bump = airlock.bump,
    )]
    pub airlock: Box<Account<'info, SpokeAirlock>>,

    #[account(
        seeds = [SPOKE_MESSAGE_EXECUTOR_SEED.as_bytes()],
        bump = message_executor.bump,
        constraint = message_executor.wormhole_core == wormhole_program.key() @ MessageExecutorError::InvalidWormholeCoreProgram
    )]
    pub message_executor: Box<Account<'info, SpokeMessageExecutor>>,

    /// The Wormhole Core Bridge program.
    /// CHECK: Ensures the correct program is used for PDA derivation
    #[account(address = CORE_BRIDGE_PROGRAM_ID)]
    pub wormhole_program: AccountInfo<'info>,

    /// The system program.
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeSpokeAirlock<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = SpokeAirlock::LEN,
        seeds = [AIRLOCK_SEED.as_bytes()],
        bump
    )]
    pub airlock: Account<'info, SpokeAirlock>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(initial_window_length: u64)]
pub struct InitializeVoteWeightWindowLengths<'info> {
    #[account(mut, address = config.governance_authority)]
    pub governance_authority: Signer<'info>,

    #[account(
        init,
        payer = governance_authority,
        space = VoteWeightWindowLengths::LEN,
        seeds = [VOTE_WEIGHT_WINDOW_LENGTHS_SEED.as_bytes()],
        bump
    )]
    pub vote_weight_window_lengths: AccountLoader<'info, VoteWeightWindowLengths>,

    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Box<Account<'info, global_config::GlobalConfig>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(new_window_length: u64)]
pub struct UpdateVoteWeightWindowLengths<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [AIRLOCK_SEED.as_bytes()],
        bump = airlock.bump,
        signer
    )]
    pub airlock: Account<'info, SpokeAirlock>,

    #[account(
        mut,
        seeds = [VOTE_WEIGHT_WINDOW_LENGTHS_SEED.as_bytes()],
        bump
    )]
    pub vote_weight_window_lengths: AccountLoader<'info, VoteWeightWindowLengths>,

    pub system_program: Program<'info, System>,
}
