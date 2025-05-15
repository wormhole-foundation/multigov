use anchor_lang::prelude::*;
use anchor_lang::solana_program;
use wormhole_anchor_sdk::wormhole::Instruction;

declare_id!("675LNkgUdRCq4EtSmNHJhdUYWPWR34K2zyj6jkhUh6YL");

pub const CONFIG_SEED: &str = "configV2";
pub const BUFFER_SEED: &str = "buffer";

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

    pub fn populate_buffer(
        ctx: Context<PopulateBuffer>,
        _payload_len: u64,
        data: VAAData,
    ) -> Result<()> {
        ctx.accounts.buffer.set_inner(data);
        Ok(())
    }

    pub fn append_payload(ctx: Context<AppendPayload>, remaining_payload: Vec<u8>) -> Result<()> {
        ctx.accounts
            .buffer
            .payload
            .append(&mut remaining_payload.clone());
        Ok(())
    }

    pub fn post_vaa(ctx: Context<PostVAA>) -> Result<()> {
        let data = &ctx.accounts.buffer;
        let ix = solana_program::instruction::Instruction {
            program_id: ctx.accounts.wormhole_program.key(),
            accounts: vec![
                AccountMeta::new_readonly(ctx.accounts.guardian_set.key(), false),
                AccountMeta::new_readonly(ctx.accounts.bridge.key(), false),
                AccountMeta::new_readonly(ctx.accounts.signature_set.key(), false),
                AccountMeta::new(ctx.accounts.vaa.key(), false),
                AccountMeta::new(ctx.accounts.payer.key(), true),
                AccountMeta::new_readonly(ctx.accounts.clock.key(), false),
                AccountMeta::new_readonly(ctx.accounts.rent.key(), false),
                AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
            ],
            data: Instruction::PostVAA {
                version: data.version,
                guardian_set_index: data.guardian_set_index,
                timestamp: data.timestamp,
                nonce: data.nonce,
                emitter_chain: data.emitter_chain,
                emitter_address: data.emitter_address,
                sequence: data.sequence,
                consistency_level: data.consistency_level,
                payload: data.payload.clone(),
            }
            .try_to_vec()?,
        };
        solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.guardian_set.to_account_info(),
                ctx.accounts.bridge.to_account_info(),
                ctx.accounts.signature_set.to_account_info(),
                ctx.accounts.vaa.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.clock.to_account_info(),
                ctx.accounts.rent.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
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

#[derive(Accounts)]
#[instruction(payload_len: u64)]
pub struct PopulateBuffer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + 56 + 4 + payload_len as usize,
        seeds = [BUFFER_SEED.as_bytes()],
        bump,
    )]
    pub buffer: Account<'info, VAAData>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AppendPayload<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [BUFFER_SEED.as_bytes()],
        bump,
    )]
    pub buffer: Account<'info, VAAData>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PostVAA<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        seeds = [BUFFER_SEED.as_bytes()],
        bump,
    )]
    pub buffer: Account<'info, VAAData>,
    /// CHECK: PostVAA accounts
    /// These accounts will be verified by Core bridge on CPI
    #[account(executable)]
    pub wormhole_program: UncheckedAccount<'info>,
    /// CHECK: see above
    pub guardian_set: UncheckedAccount<'info>,
    /// CHECK: see above
    pub bridge: UncheckedAccount<'info>,
    /// CHECK: see above
    pub signature_set: UncheckedAccount<'info>,
    /// CHECK: see above
    #[account(mut)]
    pub vaa: UncheckedAccount<'info>,
    pub payer: Signer<'info>,
    pub clock: Sysvar<'info, Clock>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Config {
    pub super_admin: Pubkey,
    pub admin: Pubkey,
    pub counter: u64,
}

#[account]
pub struct VAAData {
    pub version: u8,
    pub guardian_set_index: u32,
    pub timestamp: u32,
    pub nonce: u32,
    pub emitter_chain: u16,
    pub emitter_address: [u8; 32],
    pub sequence: u64,
    pub consistency_level: u8,
    pub payload: Vec<u8>,
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
