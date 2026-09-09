import type { SubscriptionStateTransition } from "./state-transition.entity.js";

/**
 * The append-only transition log (ADR-024 item 3).
 *
 * **Append and read only — there is deliberately no `update` and no `delete`.**
 * The port could not offer them honestly: `REVOKE UPDATE, DELETE ON
 * subscription_state_transitions FROM nexora_app` means the application role
 * cannot perform either, so a method for one would be a signature the database
 * refuses at runtime.
 */
export interface StateTransitionRepository {
  append(transition: SubscriptionStateTransition): Promise<void>;

  /** One subscription's history, newest first. Scoped by RLS, never by a predicate here. */
  listBySubscription(subscriptionId: string): Promise<readonly SubscriptionStateTransition[]>;
}
