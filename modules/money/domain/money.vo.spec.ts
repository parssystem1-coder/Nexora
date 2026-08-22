import { describe, it, expect } from "vitest";
import { Money } from "./money.vo.js";
import { CurrencyMismatchError, InvalidAllocationError, InvalidCurrencyCodeError } from "./money.errors.js";

/**
 * Deterministic PRNG. The randomized allocator property below must be
 * reproducible: a seeded generator means a failure can be replayed exactly,
 * where Math.random() would give a flaky test that proves nothing on a rerun.
 */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const CURRENCIES = ["IRR", "USD", "EUR", "JPY", "KWD"];

describe("Money construction", () => {
  it("rejects anything that is not an ISO 4217 alpha-3 uppercase code", () => {
    for (const bad of ["usd", "US", "USDD", "", "U5D", "  USD"]) {
      expect(() => Money.of(1n, bad)).toThrow(InvalidCurrencyCodeError);
    }
    expect(Money.of(1n, "USD").currency).toBe("USD");
  });

  it("holds the amount as a bigint, so magnitudes past 2^53 are exact", () => {
    // IRR has zero minor units, so a realistic rial figure is already huge.
    const huge = 9_007_199_254_740_993n; // 2^53 + 1, not representable as a JS number
    expect(Money.of(huge, "IRR").amountMinor).toBe(huge);
    expect(Money.of(huge, "IRR").amountMinor).not.toBe(BigInt(Number(huge)));
  });
});

describe("Money cross-currency safety (ADR-022 item 6)", () => {
  const usd = Money.of(1000n, "USD");
  const eur = Money.of(1000n, "EUR");

  it("throws rather than converting when adding or subtracting across currencies", () => {
    expect(() => usd.add(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd.subtract(eur)).toThrow(CurrencyMismatchError);
  });

  it("throws on ordering across currencies, where any answer would be meaningless", () => {
    expect(() => usd.compare(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd.lessThan(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd.greaterThanOrEqual(eur)).toThrow(CurrencyMismatchError);
  });

  it("returns false rather than throwing for equality, which is a total predicate", () => {
    // Deliberate asymmetry with compare(): "1000 USD is not 1000 EUR" is a
    // correct answer, and making it throw would stop any collection holding
    // mixed currencies from being compared at all.
    expect(usd.equals(eur)).toBe(false);
    expect(usd.equals(Money.of(1000n, "USD"))).toBe(true);
    expect(usd.equals(Money.of(999n, "USD"))).toBe(false);
  });

  it("refuses to sum a list into the wrong currency", () => {
    expect(() => Money.sum([usd, eur], "USD")).toThrow(CurrencyMismatchError);
    expect(Money.sum([usd, usd], "USD").amountMinor).toBe(2000n);
    expect(Money.sum([], "USD").isZero()).toBe(true);
  });
});

describe("Money arithmetic", () => {
  it("adds, subtracts, negates and scales exactly", () => {
    const a = Money.of(2500n, "USD");
    const b = Money.of(750n, "USD");
    expect(a.add(b).amountMinor).toBe(3250n);
    expect(a.subtract(b).amountMinor).toBe(1750n);
    expect(a.negate().amountMinor).toBe(-2500n);
    expect(a.multiply(3n).amountMinor).toBe(7500n);
  });

  it("classifies sign without a currency comparison", () => {
    expect(Money.of(0n, "JPY").isZero()).toBe(true);
    expect(Money.of(-1n, "JPY").isNegative()).toBe(true);
    expect(Money.of(1n, "JPY").isPositive()).toBe(true);
  });
});

describe("Money.allocate — fixed cases", () => {
  it("distributes the classic indivisible remainder instead of losing it", () => {
    // 100 cents split three ways: 34 + 33 + 33, not 33 + 33 + 33 with a cent lost.
    const parts = Money.of(100n, "USD").split(3);
    expect(parts.map((p) => p.amountMinor)).toEqual([34n, 33n, 33n]);
    expect(Money.sum(parts, "USD").amountMinor).toBe(100n);
  });

  it("allocates by ratio, giving the remainder to the largest fractional share", () => {
    // 5 cents at 3:1 => exact shares 3.75 and 1.25 => 4 and 1.
    const parts = Money.of(5n, "USD").allocate([3n, 1n]);
    expect(parts.map((p) => p.amountMinor)).toEqual([4n, 1n]);
  });

  it("splits a negative total (a refund) the same way as a charge, without straddling zero", () => {
    const parts = Money.of(-100n, "USD").split(3);
    expect(parts.map((p) => p.amountMinor)).toEqual([-34n, -33n, -33n]);
    expect(Money.sum(parts, "USD").amountMinor).toBe(-100n);
    expect(parts.every((p) => p.amountMinor <= 0n)).toBe(true);
  });

  it("handles zero-weight lines by giving them nothing, without breaking the sum", () => {
    const parts = Money.of(10n, "USD").allocate([1n, 0n, 1n]);
    expect(parts.map((p) => p.amountMinor)).toEqual([5n, 0n, 5n]);
  });

  it("works on a zero-minor-unit currency with no rounding change (ADR-022 verification)", () => {
    const parts = Money.of(1_250_000n, "IRR").split(3);
    expect(Money.sum(parts, "IRR").amountMinor).toBe(1_250_000n);
    expect(parts.map((p) => p.amountMinor)).toEqual([416_667n, 416_667n, 416_666n]);
  });

  it("is deterministic: identical input yields identical output", () => {
    const a = Money.of(1_000_003n, "KWD").allocate([7n, 11n, 13n, 17n]);
    const b = Money.of(1_000_003n, "KWD").allocate([7n, 11n, 13n, 17n]);
    expect(a.map((p) => p.amountMinor)).toEqual(b.map((p) => p.amountMinor));
  });

  it("rejects weight vectors that cannot define a split", () => {
    const money = Money.of(100n, "USD");
    expect(() => money.allocate([])).toThrow(InvalidAllocationError);
    expect(() => money.allocate([0n, 0n])).toThrow(InvalidAllocationError);
    expect(() => money.allocate([1n, -1n])).toThrow(InvalidAllocationError);
    expect(() => money.split(0)).toThrow(InvalidAllocationError);
    expect(() => money.split(1.5)).toThrow(InvalidAllocationError);
  });
});

/**
 * 08_PHASE_1_BRIEF.md §6's exit criterion, literally: "Money allocator test
 * proves parts sum to the whole over randomized inputs." Also ADR-022's
 * verification item "allocator test proves sum of allocated parts equals the
 * original total for adversarial inputs".
 *
 * The sum assertion alone is not sufficient to prove the allocator is correct
 * — an allocator that dumped the entire amount into part 0 and zeroed the rest
 * would pass it. The fairness assertion is what makes this test meaningful:
 * every part must be within one minor unit of its exact fractional share, so
 * the remainder is genuinely distributed rather than parked somewhere.
 */
describe("Money.allocate — randomized property", () => {
  it("always produces parts that sum to exactly the original whole, fairly distributed", () => {
    const rng = makeRng(0x5eed_1234);
    const iterations = 5000;
    let checked = 0;

    for (let i = 0; i < iterations; i++) {
      const currency = CURRENCIES[Math.floor(rng() * CURRENCIES.length)]!;

      // Spread of magnitudes, including zero, small indivisible amounts, and
      // figures past 2^53 where a number-backed implementation would drift.
      const magnitudeExponent = Math.floor(rng() * 18);
      const sign = rng() < 0.25 ? -1n : 1n;
      const amountMinor = sign * BigInt(Math.floor(rng() * 10 ** Math.min(magnitudeExponent, 15))) * (magnitudeExponent > 15 ? 1000n : 1n);
      const total = Money.of(amountMinor, currency);

      // 1..8 weights, occasionally including zero-weight lines.
      const partCount = 1 + Math.floor(rng() * 8);
      const weights: bigint[] = [];
      for (let w = 0; w < partCount; w++) {
        weights.push(rng() < 0.15 ? 0n : BigInt(1 + Math.floor(rng() * 1000)));
      }
      if (!weights.some((w) => w > 0n)) weights[0] = 1n;

      const parts = total.allocate(weights);

      // Property 1 — the whole is preserved exactly. No minor unit is lost or invented.
      expect(Money.sum(parts, currency).amountMinor).toBe(amountMinor);

      // Structural invariants that must hold alongside it.
      expect(parts).toHaveLength(weights.length);
      expect(parts.every((p) => p.currency === currency)).toBe(true);

      // Property 2 — fairness. |part * totalWeight - amount * weight| < totalWeight
      // is exactly "this part is within one minor unit of its exact share".
      const totalWeight = weights.reduce((sum, w) => sum + w, 0n);
      const magnitude = amountMinor < 0n ? -amountMinor : amountMinor;
      for (let p = 0; p < parts.length; p++) {
        const partMagnitude = parts[p]!.amountMinor < 0n ? -parts[p]!.amountMinor : parts[p]!.amountMinor;
        const deviation = partMagnitude * totalWeight - magnitude * weights[p]!;
        const absDeviation = deviation < 0n ? -deviation : deviation;
        expect(absDeviation).toBeLessThan(totalWeight);
      }

      // A zero weight must never receive a minor unit.
      for (let p = 0; p < parts.length; p++) {
        if (weights[p] === 0n) expect(parts[p]!.amountMinor).toBe(0n);
      }

      checked++;
    }

    expect(checked).toBe(iterations);
  });

  it("preserves the whole for adversarial weight vectors, not just random ones", () => {
    // Cases chosen to maximise remainder pressure: many parts, coprime
    // weights, and amounts one below a clean multiple.
    const adversarial: Array<{ amount: bigint; weights: bigint[] }> = [
      { amount: 1n, weights: [1n, 1n, 1n, 1n, 1n, 1n, 1n] },
      { amount: 6n, weights: [1n, 1n, 1n, 1n, 1n, 1n, 1n] },
      { amount: -1n, weights: [1n, 1n, 1n] },
      { amount: 999_999_999_999_999_999n, weights: [7n, 11n, 13n, 17n, 19n, 23n] },
      { amount: 2n, weights: [1n, 1n, 1n] },
      { amount: 0n, weights: [5n, 3n, 2n] },
      { amount: 100n, weights: [1n, 0n, 0n, 0n] },
    ];

    for (const { amount, weights } of adversarial) {
      for (const currency of CURRENCIES) {
        const parts = Money.of(amount, currency).allocate(weights);
        expect(Money.sum(parts, currency).amountMinor).toBe(amount);
      }
    }
  });
});
