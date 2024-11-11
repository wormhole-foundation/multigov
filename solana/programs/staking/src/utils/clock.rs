use anchor_lang::prelude::*;
use anchor_lang::solana_program::clock::UnixTimestamp;

pub fn get_current_time() -> UnixTimestamp {
    Clock::get().unwrap().unix_timestamp
}
