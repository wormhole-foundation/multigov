import { Connection, PublicKey } from "@solana/web3.js";
import * as borsh from "borsh";

class CheckpointData {
  owner: Uint8Array;
  nextIndex: bigint;

  constructor(fields: { owner: Uint8Array; nextIndex: bigint }) {
    this.owner = fields.owner;
    this.nextIndex = fields.nextIndex;
  }

  toString(): string {
    return `Owner: ${new PublicKey(this.owner).toBase58()}\nNext Index: ${this.nextIndex.toString()}`;
  }
}

class Checkpoint {
  timestamp: bigint;
  value: bigint;

  constructor(fields: { timestamp: bigint; value: bigint }) {
    this.timestamp = fields.timestamp;
    this.value = fields.value;
  }

  toString(): string {
    if (this.timestamp === BigInt(0) && this.value === BigInt(0)) {
      return "(Empty Checkpoint)";
    }
    return `Timestamp: ${this.timestamp.toString()}  Value: ${this.value.toString()}`;
  }
}

const checkpointDataSchema = new Map<any, any>([
  [
    CheckpointData,
    {
      kind: "struct",
      fields: [
        ["owner", [32]],
        ["nextIndex", "u64"],
      ],
    },
  ],
]);

const checkpointSchema = new Map<any, any>([
  [
    Checkpoint,
    {
      kind: "struct",
      fields: [
        ["timestamp", "u64"],
        ["value", "u64"],
      ],
    },
  ],
]);

export class CheckpointAccount {
  checkpointData: CheckpointData;
  checkpoints: Checkpoint[];

  constructor(checkpointData: CheckpointData, checkpoints: Checkpoint[]) {
    this.checkpointData = checkpointData;
    this.checkpoints = checkpoints;
  }

  getLastCheckpoint(): Checkpoint | null {
    if (this.checkpoints.length === 0) {
      return null;
    }
    return this.checkpoints[Number(this.checkpointData.nextIndex) - 1];
  }

  toString(): string {
    const checkpointsStr = this.checkpoints
      .map((checkpoint, index) => ` ${index}:[ ${checkpoint.toString()} ]`)
      .join("\n");

    return `${this.checkpointData.toString()}\nCheckpoints:\n${checkpointsStr || "No valid checkpoints available."}`;
  }
}

export async function readCheckpoints(
  connection: Connection,
  checkpointAccountPublicKey: PublicKey,
): Promise<CheckpointAccount> {
  const accountInfo = await connection.getAccountInfo(
    checkpointAccountPublicKey,
  );
  if (!accountInfo) {
    throw new Error("Cannot find account");
  }

  const data = accountInfo.data;
  const discriminatorLength = 8;
  const headerSize = discriminatorLength + 32 + 8;

  const headerData = data.slice(discriminatorLength, headerSize);
  const checkpointData = borsh.deserialize(
    checkpointDataSchema,
    CheckpointData,
    headerData,
  ) as CheckpointData;

  const checkpointsData = data.slice(headerSize);
  const elementSize = 16;
  const totalElements = Math.floor(checkpointsData.length / elementSize);

  const checkpoints: Checkpoint[] = [];
  for (let i = 0; i < totalElements; i++) {
    const offset = i * elementSize;
    const checkpointBytes = checkpointsData.slice(offset, offset + elementSize);
    const checkpoint = borsh.deserialize(
      checkpointSchema,
      Checkpoint,
      checkpointBytes,
    ) as Checkpoint;
    checkpoints.push(checkpoint);
  }

  return new CheckpointAccount(checkpointData, checkpoints);
}
