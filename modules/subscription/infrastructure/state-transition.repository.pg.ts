import type { Kysely, Transaction } from "kysely";
import type { Database } from "../../../platform/db/kysely.js";
import { SubscriptionStateTransition } from "../domain/state-transition.entity.js";
import type { StateTransitionRepository } from "../domain/state-transition.repository.js";
import type { SubscriptionStatus } from "../domain/subscription-status.js";
import type { TransitionActorType, TransitionReason } from "../domain/transition-reason.js";
import "./subscription.tables.js";

export class StateTransitionRepositoryPg implements StateTransitionRepository {
  constructor(private readonly conn: Kysely<Database> | Transaction<Database>) {}

  async append(t: SubscriptionStateTransition): Promise<void> {
    await this.conn
      .insertInto("subscription_state_transitions")
      .values({
        id: t.id,
        tenant_id: t.tenantId,
        subscription_id: t.subscriptionId,
        from_status: t.fromStatus,
        to_status: t.toStatus,
        reason_code: t.reasonCode,
        actor_type: t.actorType,
        actor_id: t.actorId,
        occurred_at: t.occurredAt.toISOString(),
      })
      .execute();
  }

  async listBySubscription(subscriptionId: string): Promise<readonly SubscriptionStateTransition[]> {
    const rows = await this.conn
      .selectFrom("subscription_state_transitions")
      .selectAll()
      .where("subscription_id", "=", subscriptionId)
      .orderBy("occurred_at", "desc")
      .execute();

    return rows.map(
      (row) =>
        new SubscriptionStateTransition(
          row.id,
          row.tenant_id,
          row.subscription_id,
          row.from_status as SubscriptionStatus,
          row.to_status as SubscriptionStatus,
          row.reason_code as TransitionReason,
          row.actor_type as TransitionActorType,
          row.actor_id,
          row.occurred_at,
        ),
    );
  }
}
