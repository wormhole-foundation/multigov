use anchor_lang::prelude::*;

declare_id!("eLUV8cwhgUC2Bcu4UA16uhuMwK8zPkx3XSzt4hd3JJ3");

pub const CONFIG_SEED: &str = "configV2";

#[program]
pub mod external_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, super_admin: Pubkey, admin: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.super_admin = super_admin;
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

    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(
            ctx.accounts.super_admin.key() == config.super_admin,
            MyError::Unauthorized
        );

        let previous_admin = config.admin;

        // Update the admin
        config.admin = new_admin;

        msg!("Admin updated successfully! New admin: {}", new_admin);

        emit!(UpdateAdminEvent {
            previous_admin: previous_admin,
            new_admin,
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
        space = 8 + 32 + 32 + 8, // discriminator + super_admin + admin + counter
        seeds = [CONFIG_SEED.as_bytes()],
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
        seeds = [CONFIG_SEED.as_bytes()],
        bump,
        has_one = admin,
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(mut)]
    pub super_admin: Signer<'info>,

    #[account(
        mut,
        seeds = [CONFIG_SEED.as_bytes()],
        bump,
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct Config {
    pub super_admin: Pubkey,
    pub admin: Pubkey,
    pub counter: u64,
}

#[event]
pub struct AdminActionEvent {
    pub admin: Pubkey,
    pub count: u64,
}

#[event]
pub struct UpdateAdminEvent {
    pub previous_admin: Pubkey,
    pub new_admin: Pubkey,
}

#[error_code]
pub enum MyError {
    #[msg("Unauthorized: Only the admin can perform this action.")]
    Unauthorized,
}
