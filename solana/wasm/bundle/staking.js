import * as wasm from "./staking_bg.wasm";
import { __wbg_set_wasm } from "./staking_bg.js";
__wbg_set_wasm(wasm);
export * from "./staking_bg.js";
