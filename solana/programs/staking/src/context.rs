use {
    crate::{
        state::*,
    },
    anchor_lang::prelude::*,
    anchor_spl::token::{
        Mint,
        Token,
        TokenAccount,
    },
};

pub const AUTHORITY_SEED: &str = "authority";
pub const CUSTODY_SEED: &str = "custody";
pub const STAKE_ACCOUNT_METADATA_SEED: &str = "stake_metadata";
pub const CONFIG_SEED: &str = "config";

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
    pub payer:                   Signer<'info>,
    // Stake program accounts:
    #[account(init, payer = payer, space = stake_account::StakeAccountMetadata::LEN, seeds = [STAKE_ACCOUNT_METADATA_SEED.as_bytes()], bump)]
    pub stake_account_metadata:  Box<Account<'info, stake_account::StakeAccountMetadata>>,
    /// CHECK : This AccountInfo is safe because it's a checked PDA
    #[account(seeds = [AUTHORITY_SEED.as_bytes()], bump)]
    pub custody_authority:       AccountInfo<'info>,
    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config:                  Account<'info, global_config::GlobalConfig>,
    // Wormhole token mint:
    #[account(address = config.wh_token_mint)]
    pub mint:                    Account<'info, Mint>,
    #[account(
        init,
        seeds = [CUSTODY_SEED.as_bytes()],
        bump,
        payer = payer,
        token::mint = mint,
        token::authority = custody_authority,
    )]
    pub stake_account_custody:   Account<'info, TokenAccount>,
    // Primitive accounts :
    pub rent:                    Sysvar<'info, Rent>,
    pub token_program:           Program<'info, Token>,
    pub system_program:          Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecoverAccount<'info> {
    // Native payer:
    #[account(address = config.governance_authority)]
    pub payer: Signer<'info>,

    // Token account:
    #[account(address = stake_account_metadata.owner)]
    pub payer_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [
            STAKE_ACCOUNT_METADATA_SEED.as_bytes()
        ],
        bump = stake_account_metadata.metadata_bump
    )]
    pub stake_account_metadata: Account<'info, stake_account::StakeAccountMetadata>,

    #[account(seeds = [CONFIG_SEED.as_bytes()], bump = config.bump)]
    pub config: Account<'info, global_config::GlobalConfig>,
}
