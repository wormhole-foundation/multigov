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
                Checkpoint,
                CheckpointData,
            },
            utils::voter_votes::get_votes,
        },
    };

    #[test]
    fn test_get_votes() {
        let mut checkpointData = CheckpointData::default();

        checkpointData.write_checkpoint(
            0,
            &Checkpoint {
                timestamp:             1,
                value:                 7,
            },
        )
        .unwrap();

        checkpointData.write_checkpoint(
            1,
            &Checkpoint {
                timestamp:             2,
                value:                 13,
            },
        )
        .unwrap();

        checkpointData.write_checkpoint(
            2,
            &Checkpoint {
                timestamp:             3,
                value:                 15,
            },
        )
        .unwrap();

        let votes = get_votes(&checkpointData).unwrap();
        assert_eq!(votes, 15);
    }
}
