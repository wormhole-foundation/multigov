use crate::state::checkpoints::CheckpointData;
use anchor_lang::prelude::*;


// pub fn get_past_votes(stake_account_checkpoints: &CheckpointData, timestamp: u64) -> Result<u64> {
//     let votes: u64 = stake_account_checkpoints
//         .get_at_probably_recent_timestamp(timestamp)?
//         .unwrap_or(0);
//     Ok(votes)
// }

// #[cfg(test)]
// pub mod tests {
//     use crate::state::checkpoints::CheckpointData;
//     use crate::utils::voter_votes::{get_past_votes, get_votes};
// 
//     #[test]
//     fn test_get_votes() {
//         let mut checkpoint_data = CheckpointData::default();
// 
//         let mut votes = get_votes(&checkpoint_data).unwrap();
//         assert_eq!(votes, 0);
// 
//         checkpoint_data.push(1, 7).unwrap();
//         checkpoint_data.push(2, 13).unwrap();
// 
//         votes = get_votes(&checkpoint_data).unwrap();
//         assert_eq!(votes, 13);
// 
//         checkpoint_data.push(3, 15).unwrap();
// 
//         votes = get_votes(&checkpoint_data).unwrap();
//         assert_eq!(votes, 15);
//     }
// 
//     #[test]
//     fn test_get_past_votes() {
//         let mut checkpoint_data = CheckpointData::default();
// 
//         let mut votes = get_past_votes(&checkpoint_data, 100).unwrap();
//         assert_eq!(votes, 0);
// 
//         checkpoint_data.push(1, 7).unwrap();
//         checkpoint_data.push(3, 13).unwrap();
//         checkpoint_data.push(5, 16).unwrap();
//         checkpoint_data.push(10, 17).unwrap();
//         checkpoint_data.push(12, 20).unwrap();
//         checkpoint_data.push(20, 34).unwrap();
// 
//         votes = get_past_votes(&checkpoint_data, 8).unwrap();
//         assert_eq!(votes, 16);
//         votes = get_past_votes(&checkpoint_data, 12).unwrap();
//         assert_eq!(votes, 20);
// 
//         checkpoint_data.push(21, 19).unwrap();
//         checkpoint_data.push(21, 50).unwrap();
//         checkpoint_data.push(25, 44).unwrap();
// 
//         votes = get_past_votes(&checkpoint_data, 21).unwrap();
//         assert_eq!(votes, 50);
//         votes = get_past_votes(&checkpoint_data, 26).unwrap();
//         assert_eq!(votes, 44);
//     }
// }
