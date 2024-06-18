#![allow(non_snake_case)]
use {
    crate::{
        state::{
            checkpoints::{
                CheckpointData,
            },
        },
    },
    anchor_lang::{
        prelude::{
            Clock,
        },
    },
    wasm_bindgen::prelude::*,
};

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

#[wasm_bindgen]
impl Constants {
    #[wasm_bindgen]
    pub fn POSITIONS_ACCOUNT_SIZE() -> usize {
        CheckpointData::LEN
    }
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}
