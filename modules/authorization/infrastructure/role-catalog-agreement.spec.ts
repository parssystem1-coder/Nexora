import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "kysely";
import { createDb } from "../../../platform/db/kysely.js";
import { loadDbConfig } from "../../../platform/config.js";
import { describeDbError } from "../../../platform/db/describe-error.js";
import { ROLE_KEYS } from "../contracts/index.js";
import "./authorization.tables.js";

/**
 * `ROLE_KEYS` (modules/authorization/domain/role-key.vo.ts) is a second
 * source of truth for the platform role catalog, deliberately not read from
 * the database at request time — Phase 1 has no tenant-custom roles, so a
 * client-supplied role key can be validated at the Zod boundary
 * (`membership.role.assign`'s input schema is built from `ROLE_KEYS`)
 * without a query. Its own comment states the obligation this proves:
 * "Adding a fourth role is a schema change ... and a one-line change here,
 * done together — never independently, or this list and the `roles` table
 * silently disagree." Nothing enforced that until now.
 *
 * Against real PostgreSQL, not a mock (AGENTS.md §8): the rule is about
 * agreement between code and the LIVE seeded catalog
 * (20260822090600_authorization__create_permission_catalog.sql), which a
 * mocked table proves nothing about. A drift in either direction is a real
 * defect: a key in `ROLE_KEYS` with no seeded row is a role the Zod schema
 * accepts but `RoleGrantRepositoryPg` then rejects at runtime
 * (`RoleNotInCatalogError`); a seeded row with no matching key in
 * `ROLE_KEYS` is a role nothing in the API can ever name or assign.
 */

const db = createDb(loadDbConfig());

beforeAll(async () => {
  try {
    await sql`select 1`.execute(db);
  } catch (err) {
    throw new Error(
      `Could not reach Postgres for the role catalog agreement test. Run "docker compose up -d". ${describeDbError(err)}`,
    );
  }
});

afterAll(async () => {
  await db.destroy();
});

describe("role catalog agreement: ROLE_KEYS <-> the seeded roles table", () => {
  it("names exactly the same set of role keys as the roles table, in both directions", async () => {
    const rows = await db.selectFrom("roles").select("key").execute();
    const seededKeys = new Set(rows.map((row) => row.key));
    const codeKeys = new Set<string>(ROLE_KEYS);

    const inCodeNotSeeded = [...codeKeys].filter((key) => !seededKeys.has(key)).sort();
    const seededNotInCode = [...seededKeys].filter((key) => !codeKeys.has(key)).sort();

    expect(
      inCodeNotSeeded,
      `ROLE_KEYS names role(s) with no seeded row in \`roles\`: ${inCodeNotSeeded.join(", ") || "(none)"}. ` +
        "Add a migration seeding it, or remove it from ROLE_KEYS.",
    ).toEqual([]);

    expect(
      seededNotInCode,
      `the \`roles\` table has row(s) ROLE_KEYS cannot name: ${seededNotInCode.join(", ") || "(none)"}. ` +
        "Add the key to ROLE_KEYS (modules/authorization/domain/role-key.vo.ts), or remove the seeded row.",
    ).toEqual([]);
  });
});
