use crate::error::ErrorCode;
use crate::state::checkpoints::resize_account;
use anchor_lang::prelude::borsh::{BorshDeserialize, BorshSerialize};
use anchor_lang::prelude::*;
use std::mem::size_of;

#[account(zero_copy)]
#[derive(Default)]
pub struct VoteWeightWindowLengths {
    pub next_index: u64,
}

impl VoteWeightWindowLengths {
    pub const VOTE_WEIGHT_WINDOW_LENGTHS_HEADER_SIZE: usize =
        VoteWeightWindowLengths::DISCRIMINATOR.len() + size_of::<VoteWeightWindowLengths>();
    pub const WINDOW_LENGTH_SIZE: usize = size_of::<WindowLength>();
    pub const LEN: usize = VoteWeightWindowLengths::VOTE_WEIGHT_WINDOW_LENGTHS_HEADER_SIZE
        + VoteWeightWindowLengths::WINDOW_LENGTH_SIZE;
    pub const MAX_VOTE_WEIGHT_WINDOW_LENGTH: u64 = 850;

    pub fn initialize(&mut self) {
        self.next_index = 1;
    }
}

pub fn write_window_length_at_index(
    account_info: &AccountInfo,
    index: usize,
    window_length: &WindowLength,
) -> Result<()> {
    require!(
        window_length.value <= VoteWeightWindowLengths::MAX_VOTE_WEIGHT_WINDOW_LENGTH,
        ErrorCode::ExceedsMaxAllowableVoteWeightWindowLength
    );

    let mut data = account_info.try_borrow_mut_data()?;
    let header_size = VoteWeightWindowLengths::VOTE_WEIGHT_WINDOW_LENGTHS_HEADER_SIZE;
    let data = &mut data[header_size..];

    let element_size = VoteWeightWindowLengths::WINDOW_LENGTH_SIZE;
    let offset = index * element_size;

    if offset + element_size > data.len() {
        return Err(ProgramError::InvalidAccountData.into());
    }

    let window_length_bytes = window_length
        .try_to_vec()
        .map_err(|_| ProgramError::InvalidAccountData)?;
    data[offset..offset + element_size].copy_from_slice(&window_length_bytes);

    Ok(())
}

pub fn read_window_length_at_index(
    account_info: &AccountInfo,
    index: usize,
) -> Result<WindowLength> {
    let data = account_info.try_borrow_data()?;
    let header_size = VoteWeightWindowLengths::VOTE_WEIGHT_WINDOW_LENGTHS_HEADER_SIZE;
    let data = &data[header_size..];

    let element_size = VoteWeightWindowLengths::WINDOW_LENGTH_SIZE;
    let offset = index * element_size;

    if offset + element_size > data.len() {
        return Err(ProgramError::InvalidAccountData.into());
    }

    let window_length_bytes = &data[offset..offset + element_size];
    let window_length = WindowLength::try_from_slice(window_length_bytes)
        .map_err(|_| ProgramError::InvalidAccountData)?;
    Ok(window_length)
}

pub fn init_window_length<'info>(
    vote_weight_window_length_account_info: &AccountInfo<'info>,
    current_timestamp: u64,
    window_length_value: u64,
) -> Result<()> {
    let window_length = WindowLength {
        timestamp: current_timestamp,
        value: window_length_value,
    };
    write_window_length_at_index(vote_weight_window_length_account_info, 0, &window_length)?;

    Ok(())
}

pub fn push_new_window_length<'info>(
    vote_weight_window_length_loader: &mut AccountLoader<'info, VoteWeightWindowLengths>,
    vote_weight_window_length_account_info: &AccountInfo<'info>,
    current_timestamp: u64,
    new_window_length_value: u64,
    payer_account_info: &AccountInfo<'info>,
    system_program_account_info: &AccountInfo<'info>,
) -> Result<()> {
    // Step 1: Immutable borrow to get latest_index and latest_timestamp
    let (current_index, latest_timestamp) = {
        let vote_weight_window_length = vote_weight_window_length_loader.load()?;
        if vote_weight_window_length.next_index == 0 {
            (0, None) // if next_index is 0, set latest_timestamp to None
        } else {
            let latest_window_length = read_window_length_at_index(
                vote_weight_window_length_account_info,
                vote_weight_window_length.next_index as usize - 1,
            )?;
            (
                vote_weight_window_length.next_index,
                Some(latest_window_length.timestamp),
            )
        }
    };

    if latest_timestamp.is_some() && latest_timestamp.unwrap() == current_timestamp {
        // Overwrite window length with same current_timestamp
        let new_window_length = WindowLength {
            timestamp: current_timestamp,
            value: new_window_length_value,
        };
        write_window_length_at_index(
            vote_weight_window_length_account_info,
            current_index as usize - 1,
            &new_window_length,
        )?;
    } else {
        // Step 2: Mutable borrow to update next_index and resize if needed
        {
            let mut vote_weight_window_length = vote_weight_window_length_loader.load_mut()?;
            vote_weight_window_length.next_index += 1;

            let required_size = VoteWeightWindowLengths::VOTE_WEIGHT_WINDOW_LENGTHS_HEADER_SIZE
                + (vote_weight_window_length.next_index as usize)
                    * VoteWeightWindowLengths::WINDOW_LENGTH_SIZE;

            drop(vote_weight_window_length);

            if required_size > vote_weight_window_length_account_info.data_len() {
                resize_account(
                    vote_weight_window_length_account_info,
                    payer_account_info,
                    system_program_account_info,
                    required_size,
                )?;
            }
        } // Mutable borrow ends here
        let new_window_length = WindowLength {
            timestamp: current_timestamp,
            value: new_window_length_value,
        };
        write_window_length_at_index(
            vote_weight_window_length_account_info,
            current_index as usize,
            &new_window_length,
        )?;
    }
    Ok(())
}

pub fn find_window_length_le(
    account_info: &AccountInfo,
    target_timestamp: u64,
) -> Result<Option<(usize, WindowLength)>> {
    let data = account_info.try_borrow_data()?;
    let header_size = VoteWeightWindowLengths::VOTE_WEIGHT_WINDOW_LENGTHS_HEADER_SIZE;
    let data = &data[header_size..];

    let element_size = VoteWeightWindowLengths::WINDOW_LENGTH_SIZE;
    let total_elements = data.len() / element_size;

    let mut low = 0;
    let mut high = total_elements;
    let mut result = None;

    if total_elements > 5 {
        let mid = total_elements - (total_elements as f64).sqrt() as usize;
        let window_length = read_window_length_at_index(account_info, mid)?;

        if window_length.timestamp <= target_timestamp {
            result = Some((mid, window_length));
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    while low < high {
        let mid = (low + high) / 2;
        let window_length = read_window_length_at_index(account_info, mid)?;

        if window_length.timestamp <= target_timestamp {
            result = Some((mid, window_length));
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    Ok(result)
}

#[derive(Clone, Copy, Default, BorshSerialize, BorshDeserialize)]
pub struct WindowLength {
    pub timestamp: u64,
    pub value: u64,
}

#[cfg(test)]
pub mod tests {
    use super::VoteWeightWindowLengths;

    #[test]
    fn check_window_length_size() {
        assert!(VoteWeightWindowLengths::WINDOW_LENGTH_SIZE == 8 + 8); // 16 (timestamp + value)
    }

    #[test]
    fn check_vote_weight_window_lengths_header_size() {
        assert!(VoteWeightWindowLengths::VOTE_WEIGHT_WINDOW_LENGTHS_HEADER_SIZE == 8 + 8);
        // 16 (discriminator + next_index)
    }

    #[test]
    fn check_vote_weight_window_lengths_size() {
        assert!(VoteWeightWindowLengths::LEN == 16 + 16); // 32 (header + checkpoint)
    }
}
