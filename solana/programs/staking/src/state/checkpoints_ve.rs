use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;
use borsh::{BorshDeserialize, BorshSerialize};

declare_id!("AzGf4kGM8fFKmTic9zS8UhVN9Kv49QiJ2TG2GiaAiWAU"); // Замініть на фактичний Program ID

pub mod checkpoint_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mut checkpoint_data = ctx.accounts.checkpoint_account.load_init()?;
        checkpoint_data.owner = *ctx.accounts.payer.key;
        checkpoint_data.next_index = 0;
        Ok(())
    }

    pub fn add_checkpoint(ctx: Context<AddCheckpoint>, timestamp: u64, value: u64) -> Result<()> {
        let account_info = &ctx.accounts.checkpoint_account.to_account_info();

        // Отримуємо мутальну позику на checkpoint_data, щоб оновити next_index
        let current_index = {
            let mut checkpoint_data = ctx.accounts.checkpoint_account.load_mut()?;
            let current_index = checkpoint_data.next_index;
            checkpoint_data.next_index += 1;
            current_index
        }; // Мутальна позика завершується тут

        let element_size = 16;
        let required_size = 8 + 32+8 + (current_index as usize + 1) * element_size;

        if required_size > account_info.data_len() {
            resize_account(
                account_info,
                &ctx.accounts.payer.to_account_info(),
                &ctx.accounts.system_program.to_account_info(),
                required_size,
            )?;
        }

        let new_checkpoint = Checkpoint { timestamp, value };

        // Записуємо новий чекпоінт
        write_checkpoint_at_index(
            account_info,
            current_index as usize,
            &new_checkpoint,
        )?;

        Ok(())
    }

    pub fn find_checkpoint(ctx: Context<FindCheckpoint>, target_timestamp: u64) -> Result<u64> {
        let account_info = &ctx.accounts.checkpoint_account.to_account_info();

        if let Some(checkpoint) = CheckpointData::find_checkpoint_le(account_info, target_timestamp)? {
            let timestamp = checkpoint.timestamp;
            let value = checkpoint.value;
            msg!("Found checkpoint: timestamp={}, value={}", timestamp, value);
            // Повертаємо знайдене значення
            Ok(checkpoint.value)
        } else {
            msg!("Checkpoint not found");
            Ok(0)
        }
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 8 + 10 * 16,
        seeds = [b"checkpoint", payer.key().as_ref()],
        bump,
    )]
    pub checkpoint_account: AccountLoader<'info, CheckpointData>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddCheckpoint<'info> {
    #[account(
        mut,
        seeds = [b"checkpoint", checkpoint_account.load()?.owner.as_ref()],
        bump,
        has_one = owner,
    )]
    pub checkpoint_account: AccountLoader<'info, CheckpointData>,
    pub owner: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FindCheckpoint<'info> {
    #[account(
        seeds = [b"checkpoint", checkpoint_account.load()?.owner.as_ref()],
        bump,
    )]
    pub checkpoint_account: AccountLoader<'info, CheckpointData>,
}

#[account(zero_copy)]
#[derive(Default)]
pub struct CheckpointData {
    pub owner: Pubkey,
    pub next_index: u64,
}

impl CheckpointData {
    pub fn find_checkpoint_le(
        account_info: &AccountInfo,
        target_timestamp: u64,
    ) -> Result<Option<Checkpoint>> {
        let data = account_info.try_borrow_data()?;
        let header_size = 8 + 32 + 8;
        let data = &data[header_size..];

        let element_size = 16;
        let total_elements = data.len() / element_size;

        let mut low = 0;
        let mut high = total_elements;
        let mut result = None;

        // Додаємо попередній пошук, якщо елементів більше певної кількості
        if total_elements > 5 {
            let mid = total_elements - (total_elements as f64).sqrt() as usize;
            let checkpoint = read_checkpoint_at_index(account_info, mid)?;

            if checkpoint.timestamp <= target_timestamp {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        // Основний бінарний пошук
        while low < high {
            let mid = (low + high) / 2;
            let checkpoint = read_checkpoint_at_index(account_info, mid)?;

            if checkpoint.timestamp <= target_timestamp {
                result = Some(checkpoint);
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        Ok(result)
    }
}

#[derive(Clone, Copy, Default, BorshSerialize, BorshDeserialize)]
pub struct Checkpoint {
    pub timestamp: u64,
    pub value: u64,
}

fn write_checkpoint_at_index(
    account_info: &AccountInfo,
    index: usize,
    checkpoint: &Checkpoint,
) -> Result<()> {
    let mut data = account_info.try_borrow_mut_data()?;
    let header_size = 8 + 32 + 8; // Враховуємо дискримінатор
    let data = &mut data[header_size..];

    let element_size = 16;
    let offset = index * element_size;

    if offset + element_size > data.len() {
        return Err(ProgramError::InvalidAccountData.into());
    }

    let checkpoint_bytes = checkpoint.try_to_vec().map_err(|_| ProgramError::InvalidAccountData)?;
    data[offset..offset + element_size].copy_from_slice(&checkpoint_bytes);

    Ok(())
}

fn read_checkpoint_at_index(
    account_info: &AccountInfo,
    index: usize,
) -> Result<Checkpoint> {
    let data = account_info.try_borrow_data()?;
    let header_size = 8 + 32+8; // Враховуємо дискримінатор
    let data = &data[header_size..];

    let element_size = 16;
    let offset = index * element_size;

    if offset + element_size > data.len() {
        return Err(ProgramError::InvalidAccountData.into());
    }

    let checkpoint_bytes = &data[offset..offset + element_size];
    let checkpoint = Checkpoint::try_from_slice(checkpoint_bytes).map_err(|_| ProgramError::InvalidAccountData)?;
    Ok(checkpoint)
}

fn resize_account<'info>(
    account_info: &AccountInfo<'info>,
    payer_info: &AccountInfo<'info>,
    system_program_info: &AccountInfo<'info>,
    new_size: usize,
) -> Result<()> {
    let current_lamports = account_info.lamports();
    let required_lamports = Rent::get()?.minimum_balance(new_size);
    let lamports_needed = required_lamports.saturating_sub(current_lamports);

    // Переводимо лампорти на акаунт, якщо потрібно
    if lamports_needed > 0 {
        invoke(
            &system_instruction::transfer(payer_info.key, account_info.key, lamports_needed),
            &[
                payer_info.clone(),
                account_info.clone(),
                system_program_info.clone(),
            ],
        )?;
    }

    // Розширюємо дані акаунту
    account_info.realloc(new_size, false)?;

    Ok(())
}
