use crate::error::ErrorCode;
use anchor_lang::prelude::borsh::{BorshDeserialize, BorshSerialize};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;

/// CheckpointData account has a fixed header (owner, next_index)
/// and a dynamic tail where checkpoints are stored in byte format
/// This is designed to be able to dynamically extend the CheckpointData account up to 10Mb
/// This will save approximately 655,000 checkpoints into one account
#[account(zero_copy)]
#[derive(Default)]
pub struct CheckpointData {
    pub owner: Pubkey,
    pub next_index: u64,
}

#[event]
pub struct DelegateVotesChanged {
    pub delegate: Pubkey,
    pub previous_balance: u64,
    pub new_balance: u64,
}

impl CheckpointData {
    pub const CHECKPOINT_SIZE: usize = 16;
    pub const CHECKPOINT_DATA_HEADER_SIZE: usize = 48;

    pub const LEN: usize = 80; // 48 + 16 (header + space for one checkpoint)

    pub fn initialize(&mut self, owner: &Pubkey) {
        self.owner = *owner;
        self.next_index = 0;
    }
}

/// Increase account allocation every time a new checkpoint is added
pub fn resize_account<'info>(
    account_info: &AccountInfo<'info>,
    payer_info: &AccountInfo<'info>,
    system_program_info: &AccountInfo<'info>,
    new_size: usize,
) -> Result<()> {
    let current_lamports = account_info.lamports();
    let required_lamports = Rent::get()?.minimum_balance(new_size);
    let lamports_needed = required_lamports.saturating_sub(current_lamports);

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

    account_info.realloc(new_size, false)?;

    Ok(())
}

pub fn write_checkpoint_at_index(
    account_info: &AccountInfo,
    index: usize,
    checkpoint: &Checkpoint,
) -> Result<()> {
    let mut data = account_info.try_borrow_mut_data()?;
    let header_size = CheckpointData::CHECKPOINT_DATA_HEADER_SIZE;
    let data = &mut data[header_size..];

    let element_size = CheckpointData::CHECKPOINT_SIZE;
    let offset = index * element_size;

    if offset + element_size > data.len() {
        return Err(ProgramError::InvalidAccountData.into());
    }

    let checkpoint_bytes = checkpoint
        .try_to_vec()
        .map_err(|_| ProgramError::InvalidAccountData)?;
    data[offset..offset + element_size].copy_from_slice(&checkpoint_bytes);

    Ok(())
}

pub fn read_checkpoint_at_index(account_info: &AccountInfo, index: usize) -> Result<Checkpoint> {
    let data = account_info.try_borrow_data()?;
    let header_size = CheckpointData::CHECKPOINT_DATA_HEADER_SIZE;
    let data = &data[header_size..];

    let element_size = CheckpointData::CHECKPOINT_SIZE;
    let offset = index * element_size;

    if offset + element_size > data.len() {
        return Err(ProgramError::InvalidAccountData.into());
    }

    let checkpoint_bytes = &data[offset..offset + element_size];
    let checkpoint = Checkpoint::try_from_slice(checkpoint_bytes)
        .map_err(|_| ProgramError::InvalidAccountData)?;
    Ok(checkpoint)
}

pub enum Operation {
    Add,
    Subtract,
}
pub fn push_checkpoint<'info>(
    checkpoints_loader: &mut AccountLoader<'info, CheckpointData>,
    checkpoints_account_info: &AccountInfo<'info>,
    amount_delta: u64,
    operation: Operation,
    current_timestamp: u64,
    payer_account_info: &AccountInfo<'info>,
    system_program_account_info: &AccountInfo<'info>,
) -> Result<()> {
    // Step 1: Immutable borrow to get latest_index and latest_checkpoint
    let (current_index, latest_checkpoint) = {
        let checkpoint_data = checkpoints_loader.load()?;
        if checkpoint_data.next_index == 0 {
            (0, None) // If next_index is 0, set both to None
        } else {
            let latest_index = checkpoint_data.next_index - 1;
            let checkpoint =
                read_checkpoint_at_index(checkpoints_account_info, latest_index as usize)?;
            (checkpoint_data.next_index, Some(checkpoint))
        }
    };
    if let Some(ref latest_checkpoint) = latest_checkpoint {
        if latest_checkpoint.timestamp != current_timestamp {
            // Step 2: Mutable borrow to update next_index and resize if needed
            {
                let mut checkpoint_data = checkpoints_loader.load_mut()?;
                checkpoint_data.next_index += 1;

                let required_size = CheckpointData::CHECKPOINT_DATA_HEADER_SIZE
                    + (checkpoint_data.next_index as usize + 1) * CheckpointData::CHECKPOINT_SIZE;

                drop(checkpoint_data);

                if required_size > checkpoints_account_info.data_len() {
                    resize_account(
                        checkpoints_account_info,
                        payer_account_info,
                        system_program_account_info,
                        required_size,
                    )?;
                }
            } // Mutable borrow ends here

            // Calculate the new value, ensuring to handle the None case properly
            let new_value = match operation {
                Operation::Add => latest_checkpoint
                    .value
                    .checked_add(amount_delta)
                    .ok_or_else(|| error!(ErrorCode::GenericOverflow))?,
                Operation::Subtract => latest_checkpoint
                    .value
                    .checked_sub(amount_delta)
                    .ok_or_else(|| error!(ErrorCode::GenericOverflow))?,
            };

            let new_checkpoint = Checkpoint {
                timestamp: current_timestamp,
                value: new_value,
            };

            write_checkpoint_at_index(
                checkpoints_account_info,
                current_index as usize,
                &new_checkpoint,
            )?;
        } else {
            // overwrite checkpoint with same current_timestamp

            // Calculate the new value, ensuring to handle the None case properly
            let new_value = match operation {
                Operation::Add => latest_checkpoint
                    .value
                    .checked_add(amount_delta)
                    .ok_or_else(|| error!(ErrorCode::GenericOverflow))?,
                Operation::Subtract => latest_checkpoint
                    .value
                    .checked_sub(amount_delta)
                    .ok_or_else(|| error!(ErrorCode::GenericOverflow))?,
            };

            let new_checkpoint = Checkpoint {
                timestamp: current_timestamp,
                value: new_value,
            };

            write_checkpoint_at_index(
                checkpoints_account_info,
                current_index as usize - 1,
                &new_checkpoint,
            )?;
        }
    } else {
        // write first checkpoint
        {
            let mut checkpoint_data = checkpoints_loader.load_mut()?;
            checkpoint_data.next_index += 1;

            let required_size = CheckpointData::CHECKPOINT_DATA_HEADER_SIZE
                + (checkpoint_data.next_index as usize + 1) * CheckpointData::CHECKPOINT_SIZE;

            drop(checkpoint_data);

            if required_size > checkpoints_account_info.data_len() {
                resize_account(
                    checkpoints_account_info,
                    payer_account_info,
                    system_program_account_info,
                    required_size,
                )?;
            }
        } // Mutable borrow ends here

        let new_checkpoint = Checkpoint {
            timestamp: current_timestamp,
            value: amount_delta,
        };

        write_checkpoint_at_index(
            checkpoints_account_info,
            current_index as usize,
            &new_checkpoint,
        )?;
    }

    Ok(())
}

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

    if total_elements > 5 {
        let mid = total_elements - (total_elements as f64).sqrt() as usize;
        let checkpoint = read_checkpoint_at_index(account_info, mid)?;

        if checkpoint.timestamp <= target_timestamp {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

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

#[derive(Clone, Copy, Default, BorshSerialize, BorshDeserialize)]
pub struct Checkpoint {
    pub timestamp: u64,
    pub value: u64,
}
