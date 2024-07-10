use crate::error::ErrorCode;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{
    Mint,
    Token,
    TokenAccount,
    Transfer
};

pub const AUTHORITY_SEED: &str = "authority";
pub const CUSTODY_SEED: &str = "custody";
pub const STAKE_ACCOUNT_METADATA_SEED: &str = "stake_metadata";
pub const CONFIG_SEED: &str = "config";
pub const VOTER_WEIGHT_RECORD_SEED: &str = "voter_weight_record";
pub const PROPOSAL_SEED: &str = "proposal";

#[derive(Accounts)]
#[instruction(config_data : global_config::GlobalConfig)]
pub struct InitConfig<'info> {
    // Native payer
    #[account(mut)]
    pub payer:          Signer<'info>,
    #[account(
        init,
        seeds = [CONFIG_SEED.as_bytes()],
        bump,
        payer = payer,
        space = global_config::GlobalConfig::LEN
    )]
    // Stake program accounts:
    pub config_account: Account<'info, global_config::GlobalConfig>,
    // Primitive accounts:
    pub rent:           Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(delegatee : Pubkey)]
pub struct Delegate<'info> {
    // Native payer:
    #[account(address = stake_account_metadata.owner)]
    pub payer: Signer<'info>,

    // User stake account:
    #[account(mut)]
    pub stake_account_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), stake_account_checkpoints.key().as_ref()],
        bump = stake_account_metadata.metadata_bump
    )]
    pub stake_account_metadata:    Box<Account<'info, stake_account::StakeAccountMetadata>>,
    /// CHECK : This AccountInfo is safe because it's a checked PDA
    #[account(seeds = [AUTHORITY_SEED.as_bytes(), stake_account_checkpoints.key().as_ref()], bump)]
    pub custody_authority:         AccountInfo<'info>,
    #[account(
        mut,
        seeds = [
            CUSTODY_SEED.as_bytes(),
            stake_account_checkpoints.key().as_ref()
        ],
        bump,
        token::mint = mint,
        token::authority = custody_authority,
    )]
    pub stake_account_custody:     Box<Account<'info, TokenAccount>>,

    // Current delegate stake account:
    #[account(mut)]
    pub current_delegate_stake_account_checkpoints:
        AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), current_delegate_stake_account_checkpoints.key().as_ref()],
        bump = current_delegate_stake_account_metadata.metadata_bump
    )]
    pub current_delegate_stake_account_metadata:
        Box<Account<'info, stake_account::StakeAccountMetadata>>,

    // Delegatee stake accounts:
    #[account(mut)]
    pub delegatee_stake_account_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(
        mut,
        seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), delegatee_stake_account_checkpoints.key().as_ref()],
        bump = delegatee_stake_account_metadata.metadata_bump
    )]
    pub delegatee_stake_account_metadata: Box<Account<'info, stake_account::StakeAccountMetadata>>,

    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Box<Account<'info, global_config::GlobalConfig>>,
    // Wormhole token mint:
    #[account(address = config.wh_token_mint)]
    pub mint:   Account<'info, Mint>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u64, against_votes : u64, for_votes: u64, abstain_votes: u64)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [PROPOSAL_SEED.as_bytes(), &proposal_id.to_be_bytes()],
        bump
    )]
    pub proposal: Account<'info, proposal::ProposalData>,

    #[account(mut)]
    pub voter_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,

    #[account(
        init_if_needed,
        payer = payer,
        space = proposal_voters_weight_cast::ProposalVotersWeightCast::LEN,
        seeds = [b"proposal_voters_weight_cast", proposal.key().as_ref(), voter_checkpoints.key().as_ref()],
        bump
    )]
    pub proposal_voters_weight_cast: Account<'info, proposal_voters_weight_cast::ProposalVotersWeightCast>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proposal_id : u64, vote_start: u64, safe_window: u64)]
pub struct AddProposal<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = proposal::ProposalData::LEN,
        seeds = [PROPOSAL_SEED.as_bytes(), &proposal_id.to_be_bytes()],
        bump
    )]
    pub proposal: Account<'info, proposal::ProposalData>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(new_authority : Pubkey)]
pub struct UpdateGovernanceAuthority<'info> {
    #[account(address = config.governance_authority)]
    pub governance_signer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config:            Account<'info, global_config::GlobalConfig>,
}

#[derive(Accounts)]
#[instruction(new_authority : Pubkey)]
pub struct UpdatePdaAuthority<'info> {
    #[account(address = config.pda_authority)]
    pub governance_signer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config:            Account<'info, global_config::GlobalConfig>,
}

#[derive(Accounts)]
#[instruction(agreement_hash : [u8; 32])]
pub struct UpdateAgreementHash<'info> {
    #[account(address = config.governance_authority)]
    pub governance_signer: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config:            Account<'info, global_config::GlobalConfig>,
}

#[derive(Accounts)]
#[instruction(owner : Pubkey)]
pub struct CreateStakeAccount<'info> {
    // Native payer:
    #[account(mut)]
    pub payer:                     Signer<'info>,
    // Stake program accounts:
    #[account(zero)]
    pub stake_account_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(init, payer = payer, space = stake_account::StakeAccountMetadata::LEN, seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), stake_account_checkpoints.key().as_ref()], bump)]
    pub stake_account_metadata:    Box<Account<'info, stake_account::StakeAccountMetadata>>,
    /// CHECK : This AccountInfo is safe because it's a checked PDA
    #[account(seeds = [AUTHORITY_SEED.as_bytes(), stake_account_checkpoints.key().as_ref()], bump)]
    pub custody_authority:         AccountInfo<'info>,
    #[account(
        init,
        payer = payer,
        space = voter_weight_record::VoterWeightRecord::LEN,
        seeds = [
            VOTER_WEIGHT_RECORD_SEED.as_bytes(),
            stake_account_checkpoints.key().as_ref()
        ],
        bump)]
    pub voter_weight_record:       Account<'info, voter_weight_record::VoterWeightRecord>,
    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config:                    Account<'info, global_config::GlobalConfig>,
    // Wormhole token mint:
    #[account(address = config.wh_token_mint)]
    pub mint:                      Account<'info, Mint>,
    #[account(
        init,
        seeds = [
            CUSTODY_SEED.as_bytes(),
            stake_account_checkpoints.key().as_ref()
        ],
        bump,
        payer = payer,
        token::mint = mint,
        token::authority = custody_authority,
    )]
    pub stake_account_custody:     Account<'info, TokenAccount>,
    // Primitive accounts :
    pub rent:                      Sysvar<'info, Rent>,
    pub token_program:             Program<'info, Token>,
    pub system_program:            Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount : u64)]
pub struct WithdrawTokens<'info> {
    // Native payer:
    #[account( address = stake_account_metadata.owner)]
    pub payer:                   Signer<'info>,
    // Destination
    #[account(mut)]
    pub destination:             Account<'info, TokenAccount>,
    // Stake program accounts:
    pub stake_account_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes(), stake_account_checkpoints.key().as_ref()], bump = stake_account_metadata.metadata_bump)]
    pub stake_account_metadata:  Account<'info, stake_account::StakeAccountMetadata>,
    #[account(
        mut,
        seeds = [CUSTODY_SEED.as_bytes(), stake_account_checkpoints.key().as_ref()],
        bump = stake_account_metadata.custody_bump,
    )]
    pub stake_account_custody:   Account<'info, TokenAccount>,
    /// CHECK : This AccountInfo is safe because it's a checked PDA
    #[account(seeds = [AUTHORITY_SEED.as_bytes(), stake_account_checkpoints.key().as_ref()], bump = stake_account_metadata.authority_bump)]
    pub custody_authority:       AccountInfo<'info>,
    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config:                  Account<'info, global_config::GlobalConfig>,
    // Primitive accounts :
    pub token_program:           Program<'info, Token>,
}


impl<'a, 'b, 'c, 'info> From<&WithdrawTokens<'info>>
    for CpiContext<'a, 'b, 'c, 'info, Transfer<'info>>
{
    fn from(accounts: &WithdrawTokens<'info>) -> CpiContext<'a, 'b, 'c, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from:      accounts.stake_account_custody.to_account_info(),
            to:        accounts.destination.to_account_info(),
            authority: accounts.custody_authority.to_account_info(),
        };
        let cpi_program = accounts.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
#[instruction(agreement_hash : [u8; 32])]
pub struct JoinDaoLlc<'info> {
    // Native payer:
    #[account(mut, address = stake_account_metadata.owner)]
    pub payer:                     Signer<'info>,
    // Stake program accounts:
    pub stake_account_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,
    #[account(mut,
        seeds = [
            STAKE_ACCOUNT_METADATA_SEED.as_bytes(),
            stake_account_checkpoints.key().as_ref()
        ],
        bump = stake_account_metadata.metadata_bump
    )]
    pub stake_account_metadata:    Account<'info, stake_account::StakeAccountMetadata>,
    #[account(
        seeds = [CONFIG_SEED.as_bytes()],
        bump = config.bump, constraint = config.agreement_hash == agreement_hash @ ErrorCode::InvalidLlcAgreement
    )]
    pub config:                    Account<'info, global_config::GlobalConfig>,
}

#[derive(Accounts)]
pub struct RecoverAccount<'info> {
    // Native payer:
    #[account(address = config.governance_authority)]
    pub payer: Signer<'info>,

    // Token account:
    #[account(address = stake_account_metadata.owner)]
    pub payer_token_account: Account<'info, TokenAccount>,

    // Stake program accounts:
    #[account(zero)]
    pub stake_account_checkpoints: AccountLoader<'info, checkpoints::CheckpointData>,

    #[account(
        mut,
        seeds = [
            STAKE_ACCOUNT_METADATA_SEED.as_bytes(),
            stake_account_checkpoints.key().as_ref()
        ],
        bump = stake_account_metadata.metadata_bump
    )]
    pub stake_account_metadata: Account<'info, stake_account::StakeAccountMetadata>,

    #[account(
        mut,
        seeds = [
            VOTER_WEIGHT_RECORD_SEED.as_bytes(),
            stake_account_checkpoints.key().as_ref()
        ],
        bump = stake_account_metadata.voter_bump
    )]
    pub voter_weight_record: Account<'info, voter_weight_record::VoterWeightRecord>,

    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Account<'info, global_config::GlobalConfig>,
}
