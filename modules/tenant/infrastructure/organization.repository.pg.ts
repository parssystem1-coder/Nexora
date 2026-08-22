import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { isUniqueViolation } from "../../../platform/db/constraint-violation.js";
import type { Organization } from "../domain/organization.entity.js";
import { OrganizationSlugTakenError } from "../domain/organization.repository.js";
import type { OrganizationRepository } from "../domain/organization.repository.js";
import "./tenant.tables.js";

/** The unique index created in 20260822090200_tenant__create_organizations.sql. */
const SLUG_UNIQUE_INDEX = "organizations_slug_key";

export class OrganizationRepositoryPg implements OrganizationRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  /**
   * No `.returning()`, and both `id` and `created_at` supplied by the caller:
   * Postgres evaluates a RETURNING clause's rows against the table's USING
   * policy, and relying on the column defaults would mean reading back values
   * this row's own tenant context may not be permitted to see. See
   * PHASE_1_TASK_1_COMPLETION_AND_TASK_2_SCOPE.md §5.3 and DECISION_LOG.md
   * "INSERT ... RETURNING re-checks the USING policy...".
   *
   * `tenant_id` is never inserted — it is `GENERATED ALWAYS AS (id) STORED`
   * and Postgres rejects an explicit value for it.
   */
  async create(organization: Organization): Promise<void> {
    try {
      await this.conn
        .insertInto("organizations")
        .values({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
          created_at: organization.createdAt.toISOString(),
          updated_at: organization.createdAt.toISOString(),
        })
        .execute();
    } catch (err) {
      if (isUniqueViolation(err, SLUG_UNIQUE_INDEX)) {
        throw new OrganizationSlugTakenError(organization.slug);
      }
      throw err;
    }
  }
}
