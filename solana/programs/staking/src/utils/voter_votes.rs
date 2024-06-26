use {
    crate::{
        state::checkpoints::{
            CheckpointData,
        },
    },
    anchor_lang::prelude::*,
};

pub fn get_votes(
    stake_account_checkpoints: &CheckpointData,
) -> Result<u64> {
    let votes: u64 = stake_account_checkpoints.latest()?
        .unwrap_or(0);
    Ok(votes)
}

#[cfg(test)]
pub mod tests {
    use {
        crate::{
            state::checkpoints::{
                CheckpointData,
            },
            utils::voter_votes::get_votes,
        },
    };

    #[test]
    fn test_get_votes() {
        let mut checkpointData = CheckpointData::default();

        checkpointData.push(1, 7).unwrap();
        checkpointData.push(2, 13).unwrap();

        let mut votes = get_votes(&checkpointData).unwrap();
        assert_eq!(votes, 13);

        checkpointData.push(3, 15).unwrap();

        votes = get_votes(&checkpointData).unwrap();
        assert_eq!(votes, 15);
    }
}
