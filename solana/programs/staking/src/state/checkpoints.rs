  use {
    crate::error::ErrorCode,
    anchor_lang::{
        prelude::{
            borsh::BorshSchema,
            *,
        },
        solana_program::{
            borsh::try_from_slice_unchecked,
        },
    },
    std::fmt::{
        Debug,
    },
};

pub const MAX_CHECKPOINTS: usize = 210;
pub const CHECKPOINT_BUFFER_SIZE: usize = 48;

#[account(zero_copy)]
#[repr(C)]
pub struct CheckpointData {
    pub owner: Pubkey,
    pub next_index: u64,
    checkpoints: [[u8; CHECKPOINT_BUFFER_SIZE]; MAX_CHECKPOINTS],
}

#[cfg(test)]
impl Default for CheckpointData {
    // Only used for testing, so unwrap is acceptable
    fn default() -> Self {
        CheckpointData {
            owner:    Pubkey::default(),
            next_index:  0,
            checkpoints: [[0u8; CHECKPOINT_BUFFER_SIZE]; MAX_CHECKPOINTS],
        }
    }
}

impl CheckpointData {
    pub const LEN: usize = 8 + 32 + 8 + MAX_CHECKPOINTS * CHECKPOINT_BUFFER_SIZE;

    pub fn initialize(&mut self, owner: &Pubkey) {
        self.owner = *owner;
        self.next_index = 0;
    }

    /// Finds first index available for a new checkpoint, increments the internal counter
    pub fn reserve_new_index(&mut self) -> Result<usize> {
        let res = self.next_index as usize;
        if res < MAX_CHECKPOINTS {
            self.next_index += 1;
            Ok(res)
        } else {
            Err(error!(ErrorCode::TooManyCheckpoints))
        }
    }

    pub fn write_checkpoint(&mut self, i: usize, &checkpoint: &Checkpoint) -> Result<()> {
        Some(checkpoint).try_write(&mut self.checkpoints[i])
    }

    pub fn read_checkpoint(&self, i: usize) -> Result<Option<Checkpoint>> {
        Option::<Checkpoint>::try_read(
            self.checkpoints
                .get(i)
                .ok_or_else(|| error!(ErrorCode::CheckpointOutOfBounds))?,
        )
    }

    pub fn latest(&self) -> Result<Option<u64>> {
        if self.next_index == 0 {
            Ok(None)
        } else {
            Ok(self.read_checkpoint((self.next_index - 1) as usize)?.map(|cp| cp.value))
        }
    }

    pub fn latest_checkpoint(&self) -> Result<Option<(u64, u64)>> {
        if self.next_index == 0 {
            Ok(None)
        } else {
            self.read_checkpoint((self.next_index - 1) as usize)?
                .map(|cp| Ok(Some((cp.value, cp.timestamp))))
                .unwrap_or(Ok(None))
        }
    }

    pub fn push(&mut self, timestamp: u64, value: u64) -> Result<(u64, u64)> {
        if self.next_index > 0 {
            let last_checkpoint = self.read_checkpoint((self.next_index - 1) as usize)?
                .ok_or(ErrorCode::CheckpointNotFound)?;

            require!(
                last_checkpoint.timestamp <= timestamp,
                ErrorCode::InvalidTimestamp
            );

            if last_checkpoint.timestamp == timestamp {
                let new_checkpoint = Checkpoint {
                    timestamp,
                    value,
                };
                self.write_checkpoint((self.next_index - 1) as usize, &new_checkpoint)?;
                Ok((last_checkpoint.value, value))
            } else {
                let new_checkpoint = Checkpoint {
                    timestamp,
                    value,
                };
                let i = self.reserve_new_index().unwrap();
                self.write_checkpoint(i, &new_checkpoint)?;
                Ok((last_checkpoint.value, value))
            }
        } else {
            let new_checkpoint = Checkpoint {
                timestamp,
                value,
            };
            let i = self.reserve_new_index().unwrap();
            self.write_checkpoint(i, &new_checkpoint)?;
            Ok((0, value))
        }
    }

    pub fn get_at_probably_recent_timestamp(&self, timestamp: u64) -> Result<Option<u64>> {
        if self.next_index == 0 {
            return Ok(None);
        }

        let len = self.next_index as usize;
        let mut low = 0;
        let mut high = len;

        if len > 5 {
            let mid = len - (len as f64).sqrt() as usize;
            if let Some(checkpoint) = self.read_checkpoint(mid)? {
                if timestamp < checkpoint.timestamp {
                    high = mid;
                } else {
                    low = mid + 1;
                }
            }
        }

        let pos = self.upper_binary_lookup(timestamp, low, high)?;
        if pos == 0 {
            Ok(None)
        } else {
            self.read_checkpoint(pos - 1)?.map(|cp| Ok(Some(cp.value))).unwrap_or(Ok(None))
        }
    }

    fn upper_binary_lookup(&self, timestamp: u64, mut low: usize, mut high: usize) -> Result<usize> {
        while low < high {
            let mid = (low + high) / 2;
            if let Some(checkpoint) = self.read_checkpoint(mid)? {
                if checkpoint.timestamp > timestamp {
                    high = mid;
                } else {
                    low = mid + 1;
                }
            } else {
                return Err(error!(ErrorCode::CheckpointNotFound));
            }
        }
        Ok(high)
    }
}

pub trait TryBorsh {
    fn try_read(slice: &[u8]) -> Result<Self>
    where
        Self: std::marker::Sized;
    fn try_write(self, slice: &mut [u8]) -> Result<()>;
}

impl<T> TryBorsh for T
where
    T: AnchorDeserialize + AnchorSerialize,
{
    fn try_read(slice: &[u8]) -> Result<Self> {
        try_from_slice_unchecked(slice).map_err(|_| error!(ErrorCode::CheckpointSerDe))
    }

    fn try_write(self, slice: &mut [u8]) -> Result<()> {
        let mut ptr = slice;
        self.serialize(&mut ptr)
            .map_err(|_| error!(ErrorCode::CheckpointSerDe))
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, BorshSchema)]
#[cfg_attr(test, derive(Hash, PartialEq, Eq))]
pub struct Checkpoint {
    pub value:     u64,
    pub timestamp: u64,
}

#[cfg(test)]
pub mod tests {
    use {
        crate::state::checkpoints::{
            Checkpoint,
            CheckpointData,
            MAX_CHECKPOINTS,
            CHECKPOINT_BUFFER_SIZE,
            TryBorsh
        },
        anchor_lang::{
            solana_program::borsh::get_packed_len,
        },
        quickcheck::{
            Arbitrary,
            Gen,
        },
        quickcheck_macros::quickcheck,
        rand::Rng,
        std::collections::HashSet,
    };

    #[test]
    fn test_serialized_size() {
        assert_eq!(
            std::mem::size_of::<CheckpointData>(),
            32 + 8 + MAX_CHECKPOINTS * CHECKPOINT_BUFFER_SIZE
        );
        assert_eq!(
            CheckpointData::LEN,
            8 + 32 + 8 + MAX_CHECKPOINTS * CHECKPOINT_BUFFER_SIZE
        );
        // Checks that the checkpoint struct fits in the individual checkpoint buffer
        assert!(get_packed_len::<Checkpoint>() < CHECKPOINT_BUFFER_SIZE);
    }

    #[test]
    fn test_none_is_zero() {
        // Checks that it's fine to initialize a checkpoint buffer with zeros
        let buffer = [0u8; CHECKPOINT_BUFFER_SIZE];
        assert!(Option::<Checkpoint>::try_read(&buffer).unwrap().is_none());
    }

    // A vector of DataOperation will be tested on both our struct and on a HashSet
    #[derive(Clone, Debug)]
    enum DataOperation {
        Add(Checkpoint),
        Modify(Checkpoint),
    }

    // Boiler plate to generate random instances
    impl Arbitrary for Checkpoint {
        fn arbitrary(g: &mut Gen) -> Self {
            return Checkpoint {
                value:     u64::arbitrary(g),
                timestamp: u64::arbitrary(g),
            };
        }
    }

    impl Arbitrary for DataOperation {
        fn arbitrary(g: &mut Gen) -> Self {
            let sample = u8::arbitrary(g);
            match sample % 2 {
                0 => {
                    return DataOperation::Add(Checkpoint::arbitrary(g));
                }
                1 => {
                    return DataOperation::Modify(Checkpoint::arbitrary(g));
                }
                _ => panic!(),
            }
        }
    }

    impl CheckpointData {
        fn to_set(self, next_index: u64) -> HashSet<Checkpoint> {
            let mut res: HashSet<Checkpoint> = HashSet::new();
            for i in 0..next_index {
                if let Some(checkpoint) = self.read_checkpoint(i as usize).unwrap() {
                    if res.contains(&checkpoint) {
                        panic!()
                    } else {
                        res.insert(checkpoint);
                    }
                } else {
                    panic!()
                }
            }

            for i in next_index..(MAX_CHECKPOINTS as u64) {
                assert_eq!(
                    Option::<Checkpoint>::None,
                    self.read_checkpoint(i as usize).unwrap()
                )
            }
            return res;
        }
    }

    #[quickcheck]
    fn prop(input: Vec<DataOperation>) -> bool {
        let mut checkpoint_data = CheckpointData::default();
        let mut next_index: u64 = 0;
        let mut set: HashSet<Checkpoint> = HashSet::new();
        let mut rng = rand::thread_rng();
        for op in input {
            match op {
                DataOperation::Add(checkpoint) => {
                    if next_index < MAX_CHECKPOINTS as u64 {
                        set.insert(checkpoint);
                        let i = checkpoint_data.reserve_new_index().unwrap();
                        checkpoint_data.write_checkpoint(i, &checkpoint).unwrap();
                        next_index = checkpoint_data.next_index;
                    } else {
                        assert!(set.len() == MAX_CHECKPOINTS);
                        assert!(checkpoint_data.reserve_new_index().is_err());
                    }
                }
                DataOperation::Modify(checkpoint) => {
                    if next_index != 0 {
                        let i: usize = rng.gen_range(0..(next_index as usize));
                        let current_checkpoint = checkpoint_data.read_checkpoint(i).unwrap().unwrap();
                        checkpoint_data.write_checkpoint(i, &checkpoint).unwrap();
                        set.remove(&current_checkpoint);
                        set.insert(checkpoint);
                    } else {
                        assert!(set.len() == 0);
                    }
                }
            }

            if set != checkpoint_data.to_set(next_index) {
                return false;
            };
        }
        return set == checkpoint_data.to_set(next_index);
    }
    
    #[test]
    fn test_get_at_probably_recent_timestamp() {
        let mut checkpoint_data = CheckpointData::default();
        
        // Add some checkpoints
        checkpoint_data.push(100, 1000).unwrap();
        checkpoint_data.push(200, 2000).unwrap();
        checkpoint_data.push(300, 3000).unwrap();
        checkpoint_data.push(400, 4000).unwrap();
        checkpoint_data.push(500, 5000).unwrap();

        // Test exact matches
        assert_eq!(checkpoint_data.get_at_probably_recent_timestamp(100).unwrap(), Some(1000));
        assert_eq!(checkpoint_data.get_at_probably_recent_timestamp(300).unwrap(), Some(3000));
        assert_eq!(checkpoint_data.get_at_probably_recent_timestamp(500).unwrap(), Some(5000));

        // Test timestamps between checkpoints
        assert_eq!(checkpoint_data.get_at_probably_recent_timestamp(150).unwrap(), Some(1000));
        assert_eq!(checkpoint_data.get_at_probably_recent_timestamp(250).unwrap(), Some(2000));
        assert_eq!(checkpoint_data.get_at_probably_recent_timestamp(450).unwrap(), Some(4000));

        // Test timestamp before first checkpoint
        assert_eq!(checkpoint_data.get_at_probably_recent_timestamp(50).unwrap(), None);

        // Test timestamp after last checkpoint
        assert_eq!(checkpoint_data.get_at_probably_recent_timestamp(600).unwrap(), Some(5000));
    }

    #[test]
    fn test_upper_binary_lookup() {
        let mut checkpoint_data = CheckpointData::default();
        
        // Add some checkpoints
        checkpoint_data.push(100, 1000).unwrap();
        checkpoint_data.push(200, 2000).unwrap();
        checkpoint_data.push(300, 3000).unwrap();
        checkpoint_data.push(400, 4000).unwrap();
        checkpoint_data.push(500, 5000).unwrap();

        // Test exact matches
        assert_eq!(checkpoint_data.upper_binary_lookup(100, 0, 5).unwrap(), 1);
        assert_eq!(checkpoint_data.upper_binary_lookup(300, 0, 5).unwrap(), 3);
        assert_eq!(checkpoint_data.upper_binary_lookup(500, 0, 5).unwrap(), 5);

        // Test timestamps between checkpoints
        assert_eq!(checkpoint_data.upper_binary_lookup(150, 0, 5).unwrap(), 1);
        assert_eq!(checkpoint_data.upper_binary_lookup(250, 0, 5).unwrap(), 2);
        assert_eq!(checkpoint_data.upper_binary_lookup(450, 0, 5).unwrap(), 4);

        // Test timestamp before first checkpoint
        assert_eq!(checkpoint_data.upper_binary_lookup(50, 0, 5).unwrap(), 0);

        // Test timestamp after last checkpoint
        assert_eq!(checkpoint_data.upper_binary_lookup(600, 0, 5).unwrap(), 5);
    }

    #[quickcheck]
    fn prop_get_at_probably_recent_timestamp(timestamps: Vec<u64>) -> bool {
        let mut checkpoint_data = CheckpointData::default();
        let mut sorted_timestamps: Vec<u64> = timestamps.into_iter().filter(|&t| t < u64::MAX / 2).collect();
        sorted_timestamps.sort();
        sorted_timestamps.dedup();

        for (i, &timestamp) in sorted_timestamps.iter().enumerate() {
            if i >= MAX_CHECKPOINTS {
                break;
            }
            checkpoint_data.push(timestamp, i as u64).unwrap();
        }

        // Check that we can retrieve all inserted checkpoints
        for (i, &timestamp) in sorted_timestamps.iter().enumerate() {
            if i >= MAX_CHECKPOINTS {
                break;
            }
            if checkpoint_data.get_at_probably_recent_timestamp(timestamp).unwrap() != Some(i as u64) {
                return false;
            }
        }

        // Check some random timestamps
        let mut rng = rand::thread_rng();
        for _ in 0..100 {
            let random_timestamp = if let Some(&last) = sorted_timestamps.last() {
                rng.gen_range(0..=last)
            } else {
                0
            };
            let expected = sorted_timestamps
                .iter()
                .enumerate()
                .take(MAX_CHECKPOINTS)
                .rev()
                .find(|(_, &t)| t <= random_timestamp)
                .map(|(i, _)| i as u64);
            if checkpoint_data.get_at_probably_recent_timestamp(random_timestamp).unwrap() != expected {
                return false;
            }
        }

        true
    }
}
