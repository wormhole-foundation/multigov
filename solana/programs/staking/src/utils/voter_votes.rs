use crate::state::checkpoints::CheckpointData;
use anchor_lang::prelude::*;

pub fn get_votes(stake_account_checkpoints: &CheckpointData) -> Result<u64> {
    let votes: u64 = stake_account_checkpoints.latest()?.unwrap_or(0);
    Ok(votes)
}

pub fn get_past_votes(stake_account_checkpoints: &CheckpointData, timestamp: u64) -> Result<u64> {
    let votes: u64 = stake_account_checkpoints
        .get_at_probably_recent_timestamp(timestamp)?
        .unwrap_or(0);
    Ok(votes)
}

#[cfg(test)]
pub mod tests {
    use crate::state::checkpoints::CheckpointData;
    use crate::utils::voter_votes::{
        get_past_votes,
        get_votes,
    };

    #[test]
    fn test_get_votes() {
        let mut checkpointData = CheckpointData::default();

        let mut votes = get_votes(&checkpointData).unwrap();
        assert_eq!(votes, 0);

        checkpointData.push(1, 7).unwrap();
        checkpointData.push(2, 13).unwrap();

        votes = get_votes(&checkpointData).unwrap();
        assert_eq!(votes, 13);

        checkpointData.push(3, 15).unwrap();

        votes = get_votes(&checkpointData).unwrap();
        assert_eq!(votes, 15);
    }

    #[test]
    fn test_get_past_votes() {
        let mut checkpointData = CheckpointData::default();

        let mut votes = get_past_votes(&checkpointData, 100).unwrap();
        assert_eq!(votes, 0);

        checkpointData.push(1, 7).unwrap();
        checkpointData.push(3, 13).unwrap();
        checkpointData.push(5, 16).unwrap();
        checkpointData.push(10, 17).unwrap();
        checkpointData.push(12, 20).unwrap();
        checkpointData.push(20, 34).unwrap();

        votes = get_past_votes(&checkpointData, 8).unwrap();
        assert_eq!(votes, 16);
        votes = get_past_votes(&checkpointData, 12).unwrap();
        assert_eq!(votes, 20);

        checkpointData.push(21, 19).unwrap();
        checkpointData.push(21, 50).unwrap();
        checkpointData.push(25, 44).unwrap();

        votes = get_past_votes(&checkpointData, 21).unwrap();
        assert_eq!(votes, 50);
        votes = get_past_votes(&checkpointData, 26).unwrap();
        assert_eq!(votes, 44);
    }
}
