import BN from "bn.js";
import assert from "assert";

export const WH_TOKEN_DECIMALS = 6;
const INTEGER_REGEXP = new RegExp(/^\d+$/);
const DECIMAL_REGEXP = new RegExp(`^\\d*\\.\\d{0,${WH_TOKEN_DECIMALS}}$`);
const TRAILING_ZEROS = new RegExp(/\.?0+$/);

export class WHTokenBalance {
  integerAmount: BN;

  constructor(integerAmount: BN) {
    this.integerAmount = integerAmount;
  }

  //THIS METHOD MAY LOSE PRECISION
  toNumber(): number {
    return this.integerAmount.toNumber() * 10 ** -WH_TOKEN_DECIMALS;
  }

  static zero(): WHTokenBalance {
    return WHTokenBalance.fromString("0");
  }
  //THIS METHOD MAY LOSE PRECISION IF AMOUNT IS NOT AN INTEGER
  static fromNumber(amount: number): WHTokenBalance {
    return new WHTokenBalance(new BN(amount * 10 ** WH_TOKEN_DECIMALS));
  }

  static fromString(amount: string) {
    amount = amount.split(",").join("");
    amount = amount.split('"').join("");
    amount = amount.split(" ").join("");

    if (amount.match(INTEGER_REGEXP)) {
      return new WHTokenBalance(
        new BN(amount).mul(new BN(10 ** WH_TOKEN_DECIMALS)),
      );
    } else if (amount.match(DECIMAL_REGEXP)) {
      const integerPart = amount.split(".")[0];
      const decimalPart = amount.split(".")[1];
      const decimalLength = decimalPart.length;

      let resBN = new BN(integerPart).mul(new BN(10 ** WH_TOKEN_DECIMALS));
      resBN = resBN.add(
        new BN(decimalPart).mul(
          new BN(10 ** (WH_TOKEN_DECIMALS - decimalLength)),
        ),
      );

      return new WHTokenBalance(resBN);
    } else {
      throw new Error("Failed parsing");
    }
  }

  toString(commas = true): string {
    const padded = this.toBN()
      .toString()
      .padStart(WH_TOKEN_DECIMALS + 1, "0");

    const integerPart = padded.slice(0, padded.length - WH_TOKEN_DECIMALS);
    return (
      (commas ? addCommas(integerPart) : integerPart) +
      ("." + padded.slice(padded.length - WH_TOKEN_DECIMALS)).replace(
        TRAILING_ZEROS,
        "",
      )
    );
  }

  toBN() {
    return this.integerAmount;
  }

  eq(other: WHTokenBalance): boolean {
    return this.toBN().eq(other.toBN());
  }

  gte(other: WHTokenBalance): boolean {
    return this.toBN().gte(other.toBN());
  }

  lt(other: WHTokenBalance): boolean {
    return this.toBN().lt(other.toBN());
  }

  gt(other: WHTokenBalance): boolean {
    return this.toBN().gt(other.toBN());
  }

  lte(other: WHTokenBalance): boolean {
    return this.toBN().lte(other.toBN());
  }

  add(other: WHTokenBalance): WHTokenBalance {
    return new WHTokenBalance(other.toBN().add(this.toBN()));
  }

  sub(other: WHTokenBalance): WHTokenBalance {
    return new WHTokenBalance(this.toBN().sub(other.toBN()));
  }

  isZero(): boolean {
    return this.eq(WHTokenBalance.zero());
  }

  min(other: WHTokenBalance): WHTokenBalance {
    return this.lt(other) ? this : other;
  }
}

const addCommas = (x: string) => {
  return x.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
