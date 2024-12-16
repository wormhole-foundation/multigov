use anchor_lang::prelude::*;

declare_id!("eLUV8cwhgUC2Bcu4UA16uhuMwK8zPkx3XSzt4hd3JJ3");

#[program]
pub mod external_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, admin: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = admin;
        config.counter = 0;
        Ok(())
    }

    pub fn admin_action(ctx: Context<AdminAction>) -> Result<()> {
        // Check that the admin account matches the stored admin
        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            MyError::Unauthorized
        );

        let config = &mut ctx.accounts.config;

        // Increment the counter
        config.counter += 1;

        msg!("Admin action performed! Count: {}", config.counter);

        emit!(AdminActionEvent {
            admin: ctx.accounts.admin.key(),
            count: config.counter,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8, // 8 bytes discriminator + 32 bytes for Pubkey + 8 bytes for u64
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    /// CHECK
    #[account(mut)]
    pub admin: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = admin,
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub counter: u64,
}

#[event]
pub struct AdminActionEvent {
    pub admin: Pubkey,
    pub count: u64,
}

#[error_code]
pub enum MyError {
    #[msg("Unauthorized: Only the admin can perform this action.")]
    Unauthorized,
}
