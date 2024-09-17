use crate::error::ErrorCode;
use anchor_lang::prelude::*;
use bytemuck::{Pod, Zeroable};
use std::fmt::Debug;
use anchor_lang::prelude::borsh::{BorshDeserialize, BorshSerialize};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;
use crate::state::checkpoints;

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
    pub const CHECKPOINT_DATA_HEADER_SIZE: usize = 40;

    pub const LEN: usize = 80; // 8 + 32 + 8 + 8


    pub fn initialize(&mut self, owner: &Pubkey) {
        self.owner = *owner;
        self.next_index = 1;
    }
}

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



pub fn read_checkpoint_at_index(
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

    // 
    // pub fn push(&mut self,
    //             account_info: &AccountInfo,
    //             timestamp: u64,
    //             value: u64) -> Result<(u64, u64)> {
    //     if self.next_index > 0 {
    //         let last_checkpoint = self
    //             .read_checkpoint((self.next_index - 1) as usize)?
    //             .ok_or(ErrorCode::CheckpointNotFound)?;
    //         let last_value = last_checkpoint.value;
    // 
    //         require!(
    //             last_checkpoint.timestamp <= timestamp,
    //             ErrorCode::InvalidTimestamp
    //         );
    // 
    //         if last_checkpoint.timestamp == timestamp {
    //             let new_checkpoint = Checkpoint { timestamp, value };
    //             self.write_checkpoint((self.next_index - 1) as usize, &new_checkpoint)?;
    //         } else {
    //             let new_checkpoint = Checkpoint { timestamp, value };
    //             let i = self.reserve_new_index().unwrap();
    //             self.write_checkpoint(i, &new_checkpoint)?;
    //         }
    // 
    //         emit!(DelegateVotesChanged {
    //             delegate: self.owner,
    //             previous_balance: last_value,
    //             new_balance: value
    //         });
    // 
    //         Ok((last_value, value))
    //     } else {
    //         let new_checkpoint = Checkpoint { timestamp, value };
    //         let i = self.reserve_new_index().unwrap();
    //         self.write_checkpoint(i, &new_checkpoint)?;
    // 
    //         emit!(DelegateVotesChanged {
    //             delegate: self.owner,
    //             previous_balance: 0,
    //             new_balance: value
    //         });
    // 
    //         Ok((0, value))
    //     }
    // }
// }

#[derive(Clone, Copy, Default, BorshSerialize, BorshDeserialize)]
pub struct Checkpoint {
    pub timestamp: u64,
    pub value: u64,
}


// #[cfg(test)]
// pub mod tests {
//     use crate::state::checkpoints::{
//         Checkpoint, CheckpointData, CHECKPOINT_BUFFER_SIZE, MAX_CHECKPOINTS,
//     };
//     use anchor_lang::Discriminator;
//     use quickcheck::{Arbitrary, Gen};
//     use quickcheck_macros::quickcheck;
//     use rand::Rng;
//     use std::collections::HashSet;
// 
//     #[test]
//     fn test_serialized_size() {
//         assert_eq!(
//             std::mem::size_of::<CheckpointData>(),
//             32 + 8 + MAX_CHECKPOINTS * CHECKPOINT_BUFFER_SIZE
//         );
//         assert!(
//             std::mem::size_of::<CheckpointData>() + CheckpointData::discriminator().len()
//                 <= CheckpointData::LEN
//         );
//         // Checks that the checkpoint struct fits in the individual checkpoint buffer
//         assert!(std::mem::size_of::<Checkpoint>() + 8 <= CHECKPOINT_BUFFER_SIZE);
//     }
// 
//     #[test]
//     fn test_none_is_zero() {
//         // Checks that it's fine to initialize a checkpoint buffer with zeros
//         let buffer = [0u8; CHECKPOINT_BUFFER_SIZE];
//         assert!(CheckpointData::read_option_checkpoint(&buffer)
//             .unwrap()
//             .is_none());
//     }
// 
//     // A vector of DataOperation will be tested on both our struct and on a HashSet
//     #[derive(Clone, Debug)]
//     enum DataOperation {
//         Add(Checkpoint),
//         Modify(Checkpoint),
//     }
// 
//     // Boiler plate to generate random instances
//     impl Arbitrary for Checkpoint {
//         fn arbitrary(g: &mut Gen) -> Self {
//             return Checkpoint {
//                 value: u64::arbitrary(g),
//                 timestamp: u64::arbitrary(g),
//             };
//         }
//     }
// 
//     impl Arbitrary for DataOperation {
//         fn arbitrary(g: &mut Gen) -> Self {
//             let sample = u8::arbitrary(g);
//             match sample % 2 {
//                 0 => {
//                     return DataOperation::Add(Checkpoint::arbitrary(g));
//                 }
//                 1 => {
//                     return DataOperation::Modify(Checkpoint::arbitrary(g));
//                 }
//                 _ => panic!(),
//             }
//         }
//     }
// 
//     impl CheckpointData {
//         fn to_set(self, next_index: u64) -> HashSet<Checkpoint> {
//             let mut res: HashSet<Checkpoint> = HashSet::new();
//             for i in 0..next_index {
//                 if let Some(checkpoint) = self.read_checkpoint(i as usize).unwrap() {
//                     if res.contains(&checkpoint) {
//                         panic!()
//                     } else {
//                         res.insert(checkpoint);
//                     }
//                 } else {
//                     panic!()
//                 }
//             }
// 
//             for i in next_index..(MAX_CHECKPOINTS as u64) {
//                 assert_eq!(
//                     Option::<Checkpoint>::None,
//                     self.read_checkpoint(i as usize).unwrap()
//                 )
//             }
//             return res;
//         }
//     }
// 
//     #[quickcheck]
//     fn prop(input: Vec<DataOperation>) -> bool {
//         let mut checkpoint_data = CheckpointData::default();
//         let mut next_index: u64 = 0;
//         let mut set: HashSet<Checkpoint> = HashSet::new();
//         let mut rng = rand::thread_rng();
//         for op in input {
//             match op {
//                 DataOperation::Add(checkpoint) => {
//                     if next_index < MAX_CHECKPOINTS as u64 {
//                         set.insert(checkpoint);
//                         let i = checkpoint_data.reserve_new_index().unwrap();
//                         checkpoint_data.write_checkpoint(i, &checkpoint).unwrap();
//                         next_index = checkpoint_data.next_index;
//                     } else {
//                         assert!(set.len() == MAX_CHECKPOINTS);
//                         assert!(checkpoint_data.reserve_new_index().is_err());
//                     }
//                 }
//                 DataOperation::Modify(checkpoint) => {
//                     if next_index != 0 {
//                         let i: usize = rng.gen_range(0..(next_index as usize));
//                         let current_checkpoint =
//                             checkpoint_data.read_checkpoint(i).unwrap().unwrap();
//                         checkpoint_data.write_checkpoint(i, &checkpoint).unwrap();
//                         set.remove(&current_checkpoint);
//                         set.insert(checkpoint);
//                     } else {
//                         assert!(set.len() == 0);
//                     }
//                 }
//             }
// 
//             if set != checkpoint_data.to_set(next_index) {
//                 return false;
//             };
//         }
//         return set == checkpoint_data.to_set(next_index);
//     }
// 
//     #[test]
//     fn test_get_at_probably_recent_timestamp() {
//         let mut checkpoint_data = CheckpointData::default();
// 
//         // Add some checkpoints
//         checkpoint_data.push(100, 1000).unwrap();
//         checkpoint_data.push(200, 2000).unwrap();
//         checkpoint_data.push(300, 3000).unwrap();
//         checkpoint_data.push(400, 4000).unwrap();
//         checkpoint_data.push(500, 5000).unwrap();
// 
//         // Test exact matches
//         assert_eq!(
//             checkpoint_data
//                 .get_at_probably_recent_timestamp(100)
//                 .unwrap(),
//             Some(1000)
//         );
//         assert_eq!(
//             checkpoint_data
//                 .get_at_probably_recent_timestamp(300)
//                 .unwrap(),
//             Some(3000)
//         );
//         assert_eq!(
//             checkpoint_data
//                 .get_at_probably_recent_timestamp(500)
//                 .unwrap(),
//             Some(5000)
//         );
// 
//         // Test timestamps between checkpoints
//         assert_eq!(
//             checkpoint_data
//                 .get_at_probably_recent_timestamp(150)
//                 .unwrap(),
//             Some(1000)
//         );
//         assert_eq!(
//             checkpoint_data
//                 .get_at_probably_recent_timestamp(250)
//                 .unwrap(),
//             Some(2000)
//         );
//         assert_eq!(
//             checkpoint_data
//                 .get_at_probably_recent_timestamp(450)
//                 .unwrap(),
//             Some(4000)
//         );
// 
//         // Test timestamp before first checkpoint
//         assert_eq!(
//             checkpoint_data
//                 .get_at_probably_recent_timestamp(50)
//                 .unwrap(),
//             None
//         );
// 
//         // Test timestamp after last checkpoint
//         assert_eq!(
//             checkpoint_data
//                 .get_at_probably_recent_timestamp(600)
//                 .unwrap(),
//             Some(5000)
//         );
//     }
// 
//     #[test]
//     fn test_upper_binary_lookup() {
//         let mut checkpoint_data = CheckpointData::default();
// 
//         // Add some checkpoints
//         checkpoint_data.push(100, 1000).unwrap();
//         checkpoint_data.push(200, 2000).unwrap();
//         checkpoint_data.push(300, 3000).unwrap();
//         checkpoint_data.push(400, 4000).unwrap();
//         checkpoint_data.push(500, 5000).unwrap();
// 
//         // Test exact matches
//         assert_eq!(checkpoint_data.upper_binary_lookup(100, 0, 5).unwrap(), 1);
//         assert_eq!(checkpoint_data.upper_binary_lookup(300, 0, 5).unwrap(), 3);
//         assert_eq!(checkpoint_data.upper_binary_lookup(500, 0, 5).unwrap(), 5);
// 
//         // Test timestamps between checkpoints
//         assert_eq!(checkpoint_data.upper_binary_lookup(150, 0, 5).unwrap(), 1);
//         assert_eq!(checkpoint_data.upper_binary_lookup(250, 0, 5).unwrap(), 2);
//         assert_eq!(checkpoint_data.upper_binary_lookup(450, 0, 5).unwrap(), 4);
// 
//         // Test timestamp before first checkpoint
//         assert_eq!(checkpoint_data.upper_binary_lookup(50, 0, 5).unwrap(), 0);
// 
//         // Test timestamp after last checkpoint
//         assert_eq!(checkpoint_data.upper_binary_lookup(600, 0, 5).unwrap(), 5);
//     }
// 
//     #[quickcheck]
//     fn prop_get_at_probably_recent_timestamp(timestamps: Vec<u64>) -> bool {
//         let mut checkpoint_data = CheckpointData::default();
//         let mut sorted_timestamps: Vec<u64> = timestamps
//             .into_iter()
//             .filter(|&t| t < u64::MAX / 2)
//             .collect();
//         sorted_timestamps.sort();
//         sorted_timestamps.dedup();
// 
//         for (i, &timestamp) in sorted_timestamps.iter().enumerate() {
//             if i >= MAX_CHECKPOINTS {
//                 break;
//             }
//             checkpoint_data.push(timestamp, i as u64).unwrap();
//         }
// 
//         // Check that we can retrieve all inserted checkpoints
//         for (i, &timestamp) in sorted_timestamps.iter().enumerate() {
//             if i >= MAX_CHECKPOINTS {
//                 break;
//             }
//             if checkpoint_data
//                 .get_at_probably_recent_timestamp(timestamp)
//                 .unwrap()
//                 != Some(i as u64)
//             {
//                 return false;
//             }
//         }
// 
//         // Check some random timestamps
//         let mut rng = rand::thread_rng();
//         for _ in 0..100 {
//             let random_timestamp = if let Some(&last) = sorted_timestamps.last() {
//                 rng.gen_range(0..=last)
//             } else {
//                 0
//             };
//             let expected = sorted_timestamps
//                 .iter()
//                 .enumerate()
//                 .take(MAX_CHECKPOINTS)
//                 .rev()
//                 .find(|(_, &t)| t <= random_timestamp)
//                 .map(|(i, _)| i as u64);
//             if checkpoint_data
//                 .get_at_probably_recent_timestamp(random_timestamp)
//                 .unwrap()
//                 != expected
//             {
//                 return false;
//             }
//         }
// 
//         true
//     }
// }
