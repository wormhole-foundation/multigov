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

pub const MAX_CHECKPOINTS: usize = 20;
// Intentionally make the buffer for checkpoints bigger than it needs for migrations
pub const CHECKPOINT_BUFFER_SIZE: usize = 200;

#[account(zero_copy)]
#[repr(C)]
pub struct CheckpointData {
    pub owner: Pubkey,
    checkpoints: [[u8; CHECKPOINT_BUFFER_SIZE]; MAX_CHECKPOINTS],
}

impl CheckpointData {
    pub const LEN: usize = 8 + 32 + MAX_CHECKPOINTS * CHECKPOINT_BUFFER_SIZE;
}

#[cfg(test)]
impl Default for CheckpointData {
    // Only used for testing, so unwrap is acceptable
    fn default() -> Self {
        CheckpointData {
            owner:     Pubkey::default(),
            checkpoints: [[0u8; CHECKPOINT_BUFFER_SIZE]; MAX_CHECKPOINTS],
        }
    }
}
impl CheckpointData {
    pub fn initialize(&mut self, owner: &Pubkey) {
        self.owner = *owner;
    }

    /// Finds first index available for a new checkpoint, increments the internal counter
    pub fn reserve_new_index(&mut self, next_index: &mut u8) -> Result<usize> {
        let res = *next_index as usize;
        *next_index += 1;
        if res < MAX_CHECKPOINTS {
            Ok(res)
        } else {
            Err(error!(ErrorCode::TooManyCheckpoints))
        }
    }

    // Makes checkpoint at index i none, and swaps checkpoints to preserve the invariant
    pub fn make_none(&mut self, i: usize, next_index: &mut u8) -> Result<()> {
        if (*next_index as usize) <= i {
            return Err(error!(ErrorCode::CheckpointOutOfBounds));
        }
        *next_index -= 1;
        self.checkpoints[i] = self.checkpoints[*next_index as usize];
        None::<Option<Checkpoint>>.try_write(&mut self.checkpoints[*next_index as usize])
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
    pub amount:                 u64,
    pub ts:                     i64,
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
            32 + MAX_CHECKPOINTS * CHECKPOINT_BUFFER_SIZE
        );
        assert_eq!(
            CheckpointData::LEN,
            8 + 32 + MAX_CHECKPOINTS * CHECKPOINT_BUFFER_SIZE
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
        Delete,
    }

    // Boiler plate to generate random instances
    impl Arbitrary for Checkpoint {
        fn arbitrary(g: &mut Gen) -> Self {
            return Checkpoint {
                amount:  u64::arbitrary(g),
                ts:      i64::arbitrary(g),
            };
        }
    }

    impl Arbitrary for DataOperation {
        fn arbitrary(g: &mut Gen) -> Self {
            let sample = u8::arbitrary(g);
            match sample % 3 {
                0 => {
                    return DataOperation::Add(Checkpoint::arbitrary(g));
                }
                1 => {
                    return DataOperation::Modify(Checkpoint::arbitrary(g));
                }
                2 => {
                    return DataOperation::Delete;
                }
                _ => panic!(),
            }
        }
    }

    impl CheckpointData {
        fn to_set(self, next_index: u8) -> HashSet<Checkpoint> {
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

            for i in next_index..(MAX_CHECKPOINTS as u8) {
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
        let mut next_index: u8 = 0;
        let mut set: HashSet<Checkpoint> = HashSet::new();
        let mut rng = rand::thread_rng();
        for op in input {
            match op {
                DataOperation::Add(checkpoint) => {
                    if next_index < MAX_CHECKPOINTS as u8 {
                        set.insert(checkpoint);
                        let i = checkpoint_data.reserve_new_index(&mut next_index).unwrap();
                        checkpoint_data.write_checkpoint(i, &checkpoint).unwrap();
                    } else {
                        assert!(set.len() == MAX_CHECKPOINTS);
                        assert!(checkpoint_data.reserve_new_index(&mut next_index).is_err());
                        next_index -= 1;
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
                DataOperation::Delete => {
                    if next_index != 0 {
                        let i: usize = rng.gen_range(0..(next_index as usize));
                        let current_checkpoint = checkpoint_data.read_checkpoint(i).unwrap().unwrap();
                        checkpoint_data.make_none(i, &mut next_index).unwrap();
                        set.remove(&current_checkpoint);
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
}
