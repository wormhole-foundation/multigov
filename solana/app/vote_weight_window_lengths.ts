import { Connection, PublicKey } from "@solana/web3.js";
import * as borsh from "borsh";

class VoteWeightWindowLengths {
  nextIndex: bigint;

  constructor(fields: { nextIndex: bigint }) {
    this.nextIndex = fields.nextIndex;
  }

  toString(): string {
    return `Next Index: ${this.nextIndex.toString()}`;
  }
}

class WindowLength {
  timestamp: bigint;
  value: bigint;

  constructor(fields: { timestamp: bigint; value: bigint }) {
    this.timestamp = fields.timestamp;
    this.value = fields.value;
  }

  toString(): string {
    if (this.timestamp === BigInt(0) && this.value === BigInt(0)) {
      return "(Empty WindowLength)";
    }
    return `Timestamp: ${this.timestamp.toString()}  Value: ${this.value.toString()}`;
  }
}

const voteWeightWindowLengthsSchema = new Map<any, any>([
  [
    VoteWeightWindowLengths,
    {
      kind: "struct",
      fields: [["nextIndex", "u64"]],
    },
  ],
]);

const windowLengthSchema = new Map<any, any>([
  [
    WindowLength,
    {
      kind: "struct",
      fields: [
        ["timestamp", "u64"],
        ["value", "u64"],
      ],
    },
  ],
]);

export class WindowLengthsAccount {
  voteWeightWindowLengths: VoteWeightWindowLengths;
  windowLengths: WindowLength[];

  constructor(
    voteWeightWindowLengths: VoteWeightWindowLengths,
    windowLengths: WindowLength[],
  ) {
    this.voteWeightWindowLengths = voteWeightWindowLengths;
    this.windowLengths = windowLengths;
  }

  getLastWindowLength(): WindowLength | null {
    if (this.windowLengths.length === 0) {
      return null;
    }
    return this.windowLengths[
      Number(this.voteWeightWindowLengths.nextIndex) - 1
    ];
  }

  toString(): string {
    const windowLengthsStr = this.windowLengths
      .map((windowLength, index) => ` ${index}:[ ${windowLength.toString()} ]`)
      .join("\n");

    return `${this.voteWeightWindowLengths.toString()}\nWindowLengths:\n${windowLengthsStr || "No valid windowLengths available."}`;
  }

  getWindowLengthCount(): number {
    return this.windowLengths.length;
  }
}

export async function readWindowLengths(
  connection: Connection,
  windowLengthsAccountPublicKey: PublicKey,
): Promise<WindowLengthsAccount> {
  const accountInfo = await connection.getAccountInfo(
    windowLengthsAccountPublicKey,
  );
  if (!accountInfo) {
    throw new Error("Cannot find account");
  }

  const data = accountInfo.data;
  const discriminatorLength = 8;
  const headerSize = discriminatorLength + 8;

  const headerData = data.slice(discriminatorLength, headerSize);
  const voteWeightWindowLengths = borsh.deserialize(
    voteWeightWindowLengthsSchema,
    VoteWeightWindowLengths,
    headerData,
  ) as VoteWeightWindowLengths;

  const windowLengthsData = data.slice(headerSize);
  const elementSize = 16;
  const totalElements = Math.floor(windowLengthsData.length / elementSize);

  const windowLengths: WindowLength[] = [];
  for (let i = 0; i < totalElements; i++) {
    const offset = i * elementSize;
    const windowLengthBytes = windowLengthsData.slice(
      offset,
      offset + elementSize,
    );
    const windowLength = borsh.deserialize(
      windowLengthSchema,
      WindowLength,
      windowLengthBytes,
    ) as WindowLength;
    windowLengths.push(windowLength);
  }

  return new WindowLengthsAccount(voteWeightWindowLengths, windowLengths);
}
