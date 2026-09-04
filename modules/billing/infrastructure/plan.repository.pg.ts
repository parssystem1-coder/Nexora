import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { Plan, PlanVersion } from "../domain/plan.entity.js";
import type { ListPlansQuery, PlanPage, PlanRepository } from "../domain/plan.repository.js";
import "./billing.tables.js";

export class PlanRepositoryPg implements PlanRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  /**
   * Two statements, not one: the page of plans with their in-force version,
   * then that page's feature keys. A join would multiply each plan row by its
   * feature count and make `limit` count feature rows rather than plans —
   * which would break the page size the cursor is issued against.
   *
   * `limit + 1` is fetched and the extra row discarded. That is how
   * `hasMore` is answered without the second scan ADR-036 item 3 rejects for
   * a total count: one extra row proves another page exists, and costs one
   * row rather than a count over the whole set.
   */
  async listByKey(query: ListPlansQuery): Promise<PlanPage> {
    let statement = this.conn
      .selectFrom("plans")
      .innerJoin("plan_versions", "plan_versions.plan_id", "plans.id")
      .select([
        "plans.id as plan_id",
        "plans.key as plan_key",
        "plan_versions.id as version_id",
        "plan_versions.version as version",
        "plan_versions.trial_period_days as trial_period_days",
        "plan_versions.effective_from as effective_from",
      ])
      // The version in force is the greatest `effective_from` not in the
      // future — ADR-055 part 5's rule for `tax_rates`, reused rather than a
      // second resolution rule invented here. DISTINCT ON takes the first row
      // per plan under the ORDER BY below, which is exactly that row.
      .where("plan_versions.effective_from", "<=", query.asOf)
      .distinctOn("plans.key")
      .orderBy("plans.key", "asc")
      .orderBy("plan_versions.effective_from", "desc")
      .orderBy("plan_versions.version", "desc");

    if (query.afterKey !== undefined) {
      // Strictly past the last key delivered: keyset seek, never an offset.
      statement = statement.where("plans.key", ">", query.afterKey);
    }

    const rows = await statement.limit(query.limit + 1).execute();
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    const featureKeysByVersion = await this.loadFeatureKeys(pageRows.map((row) => row.version_id));

    const plans = pageRows.map(
      (row) =>
        new Plan(
          row.plan_id,
          row.plan_key,
          new PlanVersion(row.version_id, row.version, row.trial_period_days, row.effective_from),
          featureKeysByVersion.get(row.version_id) ?? [],
        ),
    );

    return { plans, hasMore };
  }

  private async loadFeatureKeys(versionIds: readonly string[]): Promise<Map<string, string[]>> {
    const byVersion = new Map<string, string[]>();
    if (versionIds.length === 0) return byVersion;

    const rows = await this.conn
      .selectFrom("plan_features")
      .select(["plan_version_id", "feature_key"])
      .where("plan_version_id", "in", [...versionIds])
      .orderBy("feature_key", "asc")
      .execute();

    for (const row of rows) {
      const existing = byVersion.get(row.plan_version_id);
      if (existing) existing.push(row.feature_key);
      else byVersion.set(row.plan_version_id, [row.feature_key]);
    }
    return byVersion;
  }
}
