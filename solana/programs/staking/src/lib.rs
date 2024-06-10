#![deny(unused_must_use)]
#![allow(dead_code)]
#![allow(clippy::upper_case_acronyms)]
#![allow(clippy::result_large_err)]
#![allow(clippy::too_many_arguments)]
// Objects of type Result must be used, otherwise we might
// call a function that returns a Result and not handle the error

use {
    crate::error::ErrorCode,
    anchor_lang::prelude::*,
    anchor_spl::token::transfer,
    context::*,
    spl_governance::state::{
        governance::get_governance_data_for_realm,
        proposal::{
            get_proposal_data,
            ProposalV2,
        },
    },
    state::{
        global_config::GlobalConfig,
    },
    std::convert::TryInto,
    utils::{
        clock::{
            get_current_epoch,
            time_to_epoch,
        }
    },
};

mod state;
mod utils;

declare_id!("pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ");
#[program]
pub mod staking {

}
