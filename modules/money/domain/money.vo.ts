import { CurrencyMismatchError, InvalidAllocationError, InvalidCurrencyCodeError } from "./money.errors.js";

const ISO_4217_ALPHA3 = /^[A-Z]{3}$/;

/**
 * @singleton-role: money-allocator
 *
 * ADR-022's monetary value: integer minor units plus an explicit currency,
 * never a float and never a bare number (AGENTS.md §4 prohibits both).
 *
 * `amountMinor` is a bigint, so the platform's largest realistic amounts
 * (IRR has zero minor units, so a rial figure is already the full magnitude)
 * cannot silently lose precision the way a JS number would past 2^53.
 *
 * This file carries the ADR-030 `money-allocator` singleton role: `allocate`
 * below is the one remainder-distributing allocator in the codebase. ADR-022
 * item 5 requires proration (ADR-025) and tax to route through it rather than
 * rounding independently, so a second implementation is a conformance
 * failure, not a style preference.
 *
 * Cross-currency safety (ADR-022 item 6) is split deliberately:
 *   - arithmetic (`add`, `subtract`) and ordering (`compare` and friends)
 *     THROW on a currency mismatch, because any answer they could return
 *     would be wrong and would propagate silently.
 *   - `equals` returns false instead, because equality is a total predicate:
 *     "10 USD is not 10 EUR" is a correct and useful answer, and making it
 *     throw would mean no collection could ever hold mixed currencies.
 */
export class Money {
  private constructor(
    public readonly amountMinor: bigint,
    /** ISO 4217 alpha-3, uppercase. */
    public readonly currency: string,
  ) {}

  static of(amountMinor: bigint, currency: string): Money {
    if (!ISO_4217_ALPHA3.test(currency)) {
      throw new InvalidCurrencyCodeError(currency);
    }
    return new Money(amountMinor, currency);
  }

  static zero(currency: string): Money {
    return Money.of(0n, currency);
  }

  /**
   * ADR-022 item 8: "A balance is only ever computed per currency." The
   * currency is required rather than inferred from the first element so that
   * summing an empty list still yields a well-defined zero.
   */
  static sum(parts: readonly Money[], currency: string): Money {
    let total = Money.zero(currency);
    for (const part of parts) total = total.add(part);
    return total;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other, "add");
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other, "subtract");
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  negate(): Money {
    return new Money(-this.amountMinor, this.currency);
  }

  /**
   * Exact scaling by an integer factor. There is deliberately no
   * multiply-by-decimal here: any factor that could produce a fraction of a
   * minor unit has to declare a rounding mode (ADR-022 item 5), and the
   * platform's answer for splitting a total by a ratio is `allocate`, which
   * distributes the remainder instead of rounding each part independently.
   */
  multiply(factor: bigint): Money {
    return new Money(this.amountMinor * factor, this.currency);
  }

  /** Total predicate: false across currencies rather than throwing. See the class comment. */
  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  /** Throws across currencies: an ordering answer would be meaningless. */
  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other, "compare");
    if (this.amountMinor < other.amountMinor) return -1;
    if (this.amountMinor > other.amountMinor) return 1;
    return 0;
  }

  lessThan(other: Money): boolean {
    return this.compare(other) < 0;
  }

  lessThanOrEqual(other: Money): boolean {
    return this.compare(other) <= 0;
  }

  greaterThan(other: Money): boolean {
    return this.compare(other) > 0;
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.compare(other) >= 0;
  }

  isZero(): boolean {
    return this.amountMinor === 0n;
  }

  isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  isPositive(): boolean {
    return this.amountMinor > 0n;
  }

  /**
   * ADR-022 item 5: "Allocation of a total across lines must use a
   * remainder-distributing allocator so that the sum of parts equals the whole
   * exactly."
   *
   * Largest-remainder method. Each part gets the floor of its exact share;
   * the minor units left over — always fewer than there are parts — go one
   * each to the parts with the largest truncated remainder, ties broken by
   * lowest index so the result is deterministic for identical input.
   *
   * All arithmetic is on bigints, so there is no rounding mode to declare and
   * no floating point anywhere in the path. Negative totals allocate by
   * magnitude and are negated back, so a refund splits the same way a charge
   * does and the parts never straddle zero.
   *
   * Guarantees, both asserted over randomized inputs in money.vo.spec.ts:
   *   1. the parts sum to exactly the original amount, always;
   *   2. no part differs from its exact fractional share by a whole minor
   *      unit or more — the remainder is distributed, not dumped.
   */
  allocate(weights: readonly bigint[]): Money[] {
    if (weights.length === 0) {
      throw new InvalidAllocationError("at least one weight is required");
    }
    if (weights.some((weight) => weight < 0n)) {
      throw new InvalidAllocationError("weights must not be negative");
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n);
    if (totalWeight === 0n) {
      throw new InvalidAllocationError("weights must not sum to zero");
    }

    const negative = this.amountMinor < 0n;
    const magnitude = negative ? -this.amountMinor : this.amountMinor;

    const bases: bigint[] = [];
    const remainders: bigint[] = [];
    let distributed = 0n;

    for (const weight of weights) {
      const numerator = magnitude * weight;
      // Both operands are non-negative here, so BigInt truncation is floor.
      const base = numerator / totalWeight;
      bases.push(base);
      remainders.push(numerator - base * totalWeight);
      distributed += base;
    }

    // Each part lost strictly less than one minor unit to truncation, so the
    // leftover is strictly less than weights.length and always fits a number.
    const leftover = Number(magnitude - distributed);

    const byRemainderDesc = remainders
      .map((remainder, index) => ({ remainder, index }))
      .sort((a, b) => (a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.index - b.index));

    for (let i = 0; i < leftover; i++) {
      const target = byRemainderDesc[i]!.index;
      bases[target] = bases[target]! + 1n;
    }

    return bases.map((base) => new Money(negative ? -base : base, this.currency));
  }

  /** Even split into `parts` shares, remainder distributed by `allocate`. */
  split(parts: number): Money[] {
    if (!Number.isInteger(parts) || parts < 1) {
      throw new InvalidAllocationError("part count must be a positive integer");
    }
    return this.allocate(Array.from({ length: parts }, () => 1n));
  }

  private assertSameCurrency(other: Money, operation: string): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency, operation);
    }
  }
}
