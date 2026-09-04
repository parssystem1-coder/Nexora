import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { createDb } from "../../../platform/db/kysely.js";
import { loadDbConfig } from "../../../platform/config.js";
import { describeDbError } from "../../../platform/db/describe-error.js";
import { Money, toMoneyDto, fromMoneyDto, createCurrencyRepository } from "../../money/contracts/index.js";
import "./billing.tables.js";

/**
 * **Phase 2 item 2's proof, and the pattern for an infrastructure item.**
 *
 * `PHASE_2_BRIEF.md` §3(a) names item 2 first among seven items that surface
 * no capability. There is therefore no HTTP test to write, no guard chain, no
 * audit event and no OpenAPI entry — and the temptation is to conclude there
 * is nothing to test until something calls it. That is wrong: an item that
 * ships only schema still ships **behaviour**, and this file is where it is
 * proved. Six later infrastructure items (3, 7, 10, 11, 17, 18) can copy the
 * shape.
 *
 * What gets tested when nothing calls it yet, in the order the risks matter:
 *
 *   1. **the privileges** — that `REVOKE UPDATE, DELETE` actually denies, run
 *      as `nexora_app`, the role the application uses. `loadDbConfig()` is
 *      that role, so these are not simulations.
 *   2. **the constraints** — each one attempted and seen to fail. ADR-030's
 *      standard is that a check never observed failing proves nothing.
 *   3. **the seed** — the values a later slice will read, including the
 *      relationship ruling ب-5 fixed between them.
 *   4. **the cross-module contract** — that a stored amount round-trips
 *      through `modules/money` unchanged, which is `PHASE_2_BRIEF.md` §5's
 *      standing obligation on this item.
 *
 * It connects as `nexora_app` throughout, deliberately: a test run as the
 * schema owner would pass every privilege assertion for the wrong reason.
 */
const db = createDb(loadDbConfig());

const STANDARD_PLAN_VERSION = "1a2b3c4d-0000-4000-8000-000000000002";
const TRIAL_PLAN_VERSION = "1a2b3c4d-0000-4000-8000-000000000001";
const ANNUAL_PRICE = "2b3c4d5e-0000-4000-8000-000000000001";
const BIENNIAL_PRICE = "2b3c4d5e-0000-4000-8000-000000000002";

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(`Could not reach Postgres for the prices schema test. ${describeDbError(err)}`, { cause: err });
  }
});

afterAll(async () => {
  await db.destroy();
});

describe("prices and price_versions — privileges", () => {
  /**
   * **Every statement below targets an id that matches nothing, deliberately.**
   * PostgreSQL checks table privileges when the statement is planned, before
   * any row is matched, so a `WHERE` that selects nothing still raises
   * `permission denied` — the assertion is unaffected. What changes is the
   * blast radius: proving these assertions discriminate means temporarily
   * restoring the grants and watching them fail, and a test aimed at the real
   * seed rows **succeeds** in that window and silently rewrites the catalogue.
   * That happened once while writing this file; it is why the ids are dummies.
   */
  const NO_SUCH_ROW = "00000000-0000-4000-8000-0000000000ff";

  it("denies UPDATE on price_versions to nexora_app, the role the app runs as", async () => {
    const attempt = sql`UPDATE price_versions SET amount_minor = 1 WHERE id = ${NO_SUCH_ROW}`.execute(db);

    await expect(attempt).rejects.toThrow(/permission denied/i);
  });

  it("denies DELETE on price_versions to nexora_app", async () => {
    const attempt = sql`DELETE FROM price_versions WHERE id = ${NO_SUCH_ROW}`.execute(db);

    await expect(attempt).rejects.toThrow(/permission denied/i);
  });

  it("denies UPDATE and DELETE on plan_versions — the gap item 1 reported, now closed", async () => {
    await expect(
      sql`UPDATE plan_versions SET trial_period_days = 999 WHERE id = ${NO_SUCH_ROW}`.execute(db),
    ).rejects.toThrow(/permission denied/i);
    await expect(sql`DELETE FROM plan_versions WHERE id = ${NO_SUCH_ROW}`.execute(db)).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("denies UPDATE and DELETE on plan_features", async () => {
    await expect(
      sql`UPDATE plan_features SET feature_key = 'x' WHERE plan_version_id = ${NO_SUCH_ROW}`.execute(db),
    ).rejects.toThrow(/permission denied/i);
    await expect(sql`DELETE FROM plan_features WHERE plan_version_id = ${NO_SUCH_ROW}`.execute(db)).rejects.toThrow(
      /permission denied/i,
    );
  });

  it("still permits INSERT, because publishing a version is an append and ruling ح-2 needs it", async () => {
    // Proves the REVOKE was scoped to UPDATE and DELETE rather than sweeping
    // up the write path Phase 2.5's administration capability depends on.
    //
    // It appends a *version* of an existing price rather than a new price or
    // plan, for two reasons that are the whole difficulty of testing an
    // append-only table: `nexora_app` cannot delete what it inserts here, so
    // the row is permanent; and a new plan row would appear in `plan.list` and
    // break item 1's own assertions. A high random ordinal keeps the test
    // re-runnable without a cleanup step that the privileges forbid anyway.
    const versionId = randomUUID();
    const ordinal = 1000 + Math.floor(Math.random() * 1_000_000);

    await db
      .insertInto("price_versions")
      .values({
        id: versionId,
        price_id: ANNUAL_PRICE,
        version: ordinal,
        amount_minor: "1",
        currency_code: "IRR",
        effective_from: "2026-01-01T00:00:00Z",
      })
      .execute();

    const rows = await db.selectFrom("price_versions").select("id").where("id", "=", versionId).execute();
    expect(rows).toHaveLength(1);
  });
});

describe("prices and price_versions — constraints, each seen to fail", () => {
  it("rejects a negative amount", async () => {
    const attempt = db
      .insertInto("price_versions")
      .values({
        id: randomUUID(),
        price_id: ANNUAL_PRICE,
        version: 99,
        amount_minor: "-1",
        currency_code: "IRR",
        effective_from: "2026-01-01T00:00:00Z",
      })
      .execute();

    await expect(attempt).rejects.toThrow(/price_versions_amount_minor_non_negative/);
  });

  it("rejects a currency code that is not ISO 4217 alpha-3 uppercase", async () => {
    const attempt = db
      .insertInto("price_versions")
      .values({
        id: randomUUID(),
        price_id: ANNUAL_PRICE,
        version: 98,
        amount_minor: "1",
        currency_code: "irr",
        effective_from: "2026-01-01T00:00:00Z",
      })
      .execute();

    await expect(attempt).rejects.toThrow(/price_versions_currency_is_alpha3_upper/);
  });

  it("rejects a second price for the same plan version and term length", async () => {
    const attempt = db
      .insertInto("prices")
      .values({ id: randomUUID(), plan_version_id: STANDARD_PLAN_VERSION, term_length: "1 year" })
      .execute();

    await expect(attempt).rejects.toThrow(/prices_plan_version_id_term_length_key/);
  });

  it("rejects a zero-length term", async () => {
    const attempt = db
      .insertInto("prices")
      .values({ id: randomUUID(), plan_version_id: STANDARD_PLAN_VERSION, term_length: "0" })
      .execute();

    await expect(attempt).rejects.toThrow(/prices_term_length_positive/);
  });

  it("rejects a repeated version ordinal for one price", async () => {
    const attempt = db
      .insertInto("price_versions")
      .values({
        id: randomUUID(),
        price_id: ANNUAL_PRICE,
        version: 1,
        amount_minor: "1",
        currency_code: "IRR",
        effective_from: "2026-01-01T00:00:00Z",
      })
      .execute();

    await expect(attempt).rejects.toThrow(/price_versions_price_id_version_key/);
  });
});

describe("the seed", () => {
  it("prices the standard plan for one year and two years, and nothing else", async () => {
    const rows = await db
      .selectFrom("prices")
      .select(["id", sql<string>`term_length::text`.as("term")])
      .where("plan_version_id", "=", STANDARD_PLAN_VERSION)
      .orderBy("term_length", "asc")
      .execute();

    expect(rows.map((r) => r.term)).toEqual(["1 year", "2 years"]);
  });

  it("leaves the trial plan with no price at all, which is what free means here", async () => {
    const rows = await db.selectFrom("prices").select("id").where("plan_version_id", "=", TRIAL_PLAN_VERSION).execute();

    expect(rows).toHaveLength(0);
  });

  it("stores ب-5's discount as an amount rather than computing it: biennial is 80% of twice annual", async () => {
    const rows = await db
      .selectFrom("price_versions")
      .select(["price_id", "amount_minor", "currency_code"])
      .where("price_id", "in", [ANNUAL_PRICE, BIENNIAL_PRICE])
      .where("version", "=", 1)
      .execute();

    const annual = BigInt(rows.find((r) => r.price_id === ANNUAL_PRICE)!.amount_minor);
    const biennial = BigInt(rows.find((r) => r.price_id === BIENNIAL_PRICE)!.amount_minor);

    expect(annual).toBe(60_000_000n);
    expect(biennial).toBe(96_000_000n);
    // The relationship holds exactly in integer arithmetic — no rounding, and
    // therefore nothing for ADR-022 item 5 to declare a mode for. It is
    // asserted here as a property of the seed, not as a rule the schema keeps:
    // the whole point of ب-5 is that a later publish may break this ratio
    // freely, because the amount is stored and not derived.
    expect((annual * 2n * 80n) / 100n).toBe(biennial);
    expect(rows.every((r) => r.currency_code === "IRR")).toBe(true);
  });
});

describe("the money contract, exercised across the module boundary", () => {
  /**
   * `PHASE_2_BRIEF.md` §5: "Over the wire: MoneyDto ... This shape has never
   * crossed a real capability ... **Item 2 is its first test, and owes a
   * contract test proving a zero-minor-unit currency round-trips unchanged.**"
   *
   * One honest limitation, recorded rather than papered over: **§6's exit
   * criterion 14 asks for a round trip "through API, database and invoice",
   * and this covers the database leg only.** Item 2 surfaces no capability, so
   * there is no API to cross, and `invoices` does not exist until item 13.
   * The criterion stays open; what is proved here is that the database leg and
   * the DTO conversion lose nothing.
   */
  it("round-trips a stored IRR amount through Money and MoneyDto unchanged", async () => {
    const currency = await createCurrencyRepository(db).findByCode("IRR");
    expect(currency).not.toBeNull();
    expect(currency!.minorUnits).toBe(0);

    const row = await db
      .selectFrom("price_versions")
      .select(["amount_minor", "currency_code"])
      .where("price_id", "=", ANNUAL_PRICE)
      .where("version", "=", 1)
      .executeTakeFirstOrThrow();

    const money = Money.of(BigInt(row.amount_minor), row.currency_code);
    const dto = toMoneyDto(money, currency!);

    expect(dto).toEqual({ amount: "60000000", currency: "IRR", minorUnits: 0 });
    expect(fromMoneyDto(dto, currency!).equals(money)).toBe(true);
  });

  it("carries no display unit: the Toman divisor never leaves the currency registry", async () => {
    const currency = await createCurrencyRepository(db).findByCode("IRR");
    const dto = toMoneyDto(Money.of(60_000_000n, "IRR"), currency!);

    // ADR-022 items 4 and 10: `Currency` carries only code, name and
    // minorUnits, so a presentation divisor cannot reach a DTO even by
    // accident. Asserted rather than assumed, because the divisor is 10 and a
    // silent division by it is a tenfold error that still looks like money.
    expect(Object.keys(dto).sort()).toEqual(["amount", "currency", "minorUnits"]);
    expect(JSON.stringify(dto)).not.toContain("IRT");
    expect(dto.amount).toBe("60000000");
  });
});
