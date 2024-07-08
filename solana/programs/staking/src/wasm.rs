#![allow(non_snake_case)]
use crate::state::checkpoints::CheckpointData;
use crate::state::proposal::ProposalData;
use anchor_lang::{
        prelude::{
            Clock,
            Error,
        },
        AccountDeserialize,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmCheckpointData {
    wrapped: CheckpointData,
}

#[wasm_bindgen]
impl WasmCheckpointData {
    #[wasm_bindgen(constructor)]
    pub fn from_buffer(buffer: &[u8]) -> Result<WasmCheckpointData, JsValue> {
        convert_error(WasmCheckpointData::from_buffer_impl(
            &buffer[..CheckpointData::LEN],
        ))
    }
    fn from_buffer_impl(buffer: &[u8]) -> Result<WasmCheckpointData, Error> {
        let mut ptr = buffer;
        let checkpoint_data = CheckpointData::try_deserialize(&mut ptr)?;
        Ok(WasmCheckpointData {
            wrapped: checkpoint_data,
        })
    }

    #[wasm_bindgen(js_name=getVoterVotes)]
    pub fn get_voter_votes(&self) -> Result<u64, JsValue> {
        convert_error(crate::utils::voter_votes::get_votes(&self.wrapped))
    }

    #[wasm_bindgen(js_name=getVoterPastVotes)]
    pub fn get_voter_past_votes(&self, timestamp: u64) -> Result<u64, JsValue> {
        convert_error(crate::utils::voter_votes::get_past_votes(
            &self.wrapped,
            timestamp,
        ))
    }
}

#[wasm_bindgen]
pub struct VotesSummary {
    pub against_votes: u64,
    pub for_votes:     u64,
    pub abstain_votes: u64,
}

#[wasm_bindgen]
pub struct WasmProposalData {
    wrapped: ProposalData,
}

#[wasm_bindgen]
impl WasmProposalData {
    #[wasm_bindgen(constructor)]
    pub fn from_buffer(buffer: &[u8]) -> Result<WasmProposalData, JsValue> {
        convert_error(WasmProposalData::from_buffer_impl(
            &buffer[..ProposalData::LEN],
        ))
    }

    fn from_buffer_impl(buffer: &[u8]) -> Result<WasmProposalData, Error> {
        let mut ptr = buffer;
        let proposal_data = ProposalData::try_deserialize(&mut ptr)?;
        Ok(WasmProposalData {
            wrapped: proposal_data,
        })
    }

    #[wasm_bindgen(js_name=proposalVotes)]
    pub fn proposal_votes(&self) -> Result<VotesSummary, JsValue> {
        let Ok(Some((against_votes, for_votes, abstain_votes))) = self.wrapped.proposal_votes() else {
            return Err("Failed to get proposal votes".into());
        };
        convert_error::<_, std::convert::Infallible>(Ok(VotesSummary {
            against_votes,
            for_votes,
            abstain_votes
        }))
    }
}

#[wasm_bindgen(js_name=getUnixTime)]
/// Deserializes the contents of the SYSVAR_CLOCK account (onChainSerialized), returning the
/// Unix time field
pub fn get_unix_time(onChainSerialized: &[u8]) -> Result<i64, JsValue> {
    convert_error(get_unix_time_impl(onChainSerialized))
}
fn get_unix_time_impl(on_chain_serialized: &[u8]) -> anchor_lang::Result<i64> {
    let clock: Clock = bincode::deserialize(on_chain_serialized)
        .map_err(|_| anchor_lang::error::ErrorCode::AccountDidNotDeserialize)?;
    Ok(clock.unix_timestamp)
}

/// Most of the Rust code returns anchor_lang::Result<T>, which is core::result::Result<T,
/// anchor_lang::error::Error> in order to return a result via WASM, we need to return a
/// core::result::Result<T, JsValue> and anchor_lang::error::Error is not convertible to a JsValue.
/// This method manually converts it by making a generic error that has the right error message.
fn convert_error<T, E>(return_val: Result<T, E>) -> Result<T, JsValue>
where
    E: std::fmt::Display,
{
    match return_val {
        Ok(x) => Ok(x),
        Err(e) => Err(e.to_string().into()),
    }
}

#[wasm_bindgen]
pub struct Constants {}
// Define a macro to re-export these constants to prevent copy-paste errors (already almost made
// one)
macro_rules! reexport_seed_const {
    ( $c:ident ) => {
        #[wasm_bindgen]
        impl Constants {
            #[wasm_bindgen]
            pub fn $c() -> js_sys::JsString {
                crate::context::$c.into()
            }
        }
    };
}

reexport_seed_const!(AUTHORITY_SEED);
reexport_seed_const!(CUSTODY_SEED);
reexport_seed_const!(STAKE_ACCOUNT_METADATA_SEED);
reexport_seed_const!(CONFIG_SEED);
reexport_seed_const!(VOTER_WEIGHT_RECORD_SEED);
reexport_seed_const!(PROPOSAL_SEED);

#[wasm_bindgen]
impl Constants {
    #[wasm_bindgen]
    pub fn CHECKPOINT_DATA_SIZE() -> usize {
        CheckpointData::LEN
    }
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}
