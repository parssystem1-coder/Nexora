import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import { createDb } from "../../../platform/db/kysely.js";
import { loadDbConfig } from "../../../platform/config.js";
import { describeDbError } from "../../../platform/db/describe-error.js";
import { Money, toMoneyDto, fromMoneyDto, createCurrencyRepository } from "../contracts/index.js";
import "./money.tables.js";

/**
 * The currency registry against real PostgreSQL, not a mock — ADR-022 item 3
 * makes the minor-unit exponent database-resident precisely so nothing
 * hard-codes 2, and a mocked registry would prove nothing about that.
 */

const db = createDb(loadDbConfig());

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(`Could not reach Postgres for the currency registry test. Run "docker compose up -d". ${describeDbError(err)}`);
  }
});

afterAll(async () => {
  await db.destroy();
});

describe("currency registry", () => {
  it("carries a real per-currency minor-unit exponent, not a default of 2", async () => {
    const currencies = createCurrencyRepository(db);

    const irr = await currencies.findByCode("IRR");
    const usd = await currencies.findByCode("USD");
    const kwd = await currencies.findByCode("KWD");

    expect(irr?.minorUnits).toBe(0);
    expect(usd?.minorUnits).toBe(2);
    expect(kwd?.minorUnits).toBe(3);
  });

  it("seeds at least one zero-minor-unit currency as a first-class entry", async () => {
    const currencies = await createCurrencyRepository(db).listActive();
    const zeroMinorUnit = currencies.filter((c) => c.minorUnits === 0);
    expect(zeroMinorUnit.map((c) => c.code).sort()).toEqual(["IRR", "JPY"]);
  });

  it("returns null for an unknown code rather than inventing a currency", async () => {
    expect(await createCurrencyRepository(db).findByCode("ZZZ")).toBeNull();
  });

  it("never exposes a presentation unit to domain code (ADR-022 item 4)", async () => {
    // The row carries presentation_code/divisor/symbol for IRR, but the
    // domain entity must not surface them — that is the whole point of the
    // "display is not storage" rule.
    const irr = await createCurrencyRepository(db).findByCode("IRR");
    expect(irr).not.toBeNull();
    expect(Object.keys(irr!)).toEqual(["code", "name", "minorUnits"]);

    const row = await db
      .selectFrom("currencies")
      .select(["presentation_code", "presentation_divisor"])
      .where("code", "=", "IRR")
      .executeTakeFirstOrThrow();
    expect(row.presentation_code).toBe("IRT");
    expect(row.presentation_divisor).toBe("10");
  });

  it("round-trips a zero-minor-unit amount through the API contract with no rounding change", async () => {
    // ADR-022's verification item, end to end: registry -> Money -> DTO -> Money.
    const irr = await createCurrencyRepository(db).findByCode("IRR");
    const original = Money.of(1_250_000n, "IRR");

    const dto = toMoneyDto(original, irr!);
    expect(dto).toEqual({ amount: "1250000", currency: "IRR", minorUnits: 0 });

    const restored = fromMoneyDto(dto, irr!);
    expect(restored.equals(original)).toBe(true);
    expect(restored.amountMinor).toBe(1_250_000n);
  });

  it("serializes the amount as a string, never a JSON number (ADR-022 item 7)", async () => {
    const usd = await createCurrencyRepository(db).findByCode("USD");
    const dto = toMoneyDto(Money.of(9_007_199_254_740_993n, "USD"), usd!);

    expect(typeof dto.amount).toBe("string");
    // Past 2^53 a JSON number would silently change the value; the string does not.
    expect(JSON.parse(JSON.stringify(dto)).amount).toBe("9007199254740993");
  });

  it("refuses to serialize money against the wrong currency's exponent", async () => {
    const usd = await createCurrencyRepository(db).findByCode("USD");
    expect(() => toMoneyDto(Money.of(100n, "IRR"), usd!)).toThrow(/cross-currency/i);
    expect(() => fromMoneyDto({ amount: "100", currency: "USD", minorUnits: 0 }, usd!)).toThrow(/cross-currency/i);
  });
});
