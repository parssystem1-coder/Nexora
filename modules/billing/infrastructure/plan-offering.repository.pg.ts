import { sql } from "kysely";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import type { FindOfferingQuery, PlanOffering, PlanOfferingRepository } from "../domain/plan-offering.repository.js";
import "./billing.tables.js";

export class PlanOfferingRepositoryPg implements PlanOfferingRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async findOffering(query: FindOfferingQuery): Promise<PlanOffering | null> {
    const row = await this.conn
      .selectFrom("plan_versions")
      .innerJoin("prices", "prices.plan_version_id", "plan_versions.id")
      .innerJoin("price_versions", "price_versions.price_id", "prices.id")
      .select([
        "plan_versions.id as plan_version_id",
        "plan_versions.trial_period_days as trial_period_days",
        "price_versions.id as price_version_id",
        sql<string>`prices.term_length::text`.as("term_length"),
      ])
      .where("plan_versions.id", "=", query.planVersionId)
      // The in-force version of each, ADR-055 part 5's resolution rule.
      .where("plan_versions.effective_from", "<=", query.asOf)
      .where("price_versions.effective_from", "<=", query.asOf)
      // `interval '12 months' = interval '1 year'` in PostgreSQL — both
      // normalise to twelve months — so a caller asking in months matches the
      // `1 year` and `2 years` rows item 2 seeded without a translation table.
      .where(sql<boolean>`prices.term_length = make_interval(months => ${query.termMonths})`)
      // If a price has several versions in force, the latest one wins, matching
      // how item 1 resolves a plan version.
      .orderBy("price_versions.effective_from", "desc")
      .orderBy("price_versions.version", "desc")
      .executeTakeFirst();

    if (!row) return null;

    return {
      planVersionId: row.plan_version_id,
      priceVersionId: row.price_version_id,
      trialPeriodDays: row.trial_period_days,
      termLength: row.term_length,
    };
  }
}
