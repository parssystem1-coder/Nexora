/**
 * `modules/subscription`'s public surface — the only thing another module may
 * import (`03_TECHNICAL_BLUEPRINT.md` §2, enforced by DEP-DIRECTION-CROSS-MODULE).
 *
 * **`isServing` is the reason this file matters more than most contracts
 * barrels.** ADR-024 item 2 requires that "exactly one function answers 'is this
 * tenant entitled to be served right now'. Interfaces, storefront routing and
 * capability policy all call it." Phase 4's host resolution, ADR-059's
 * 503-versus-410 decision and every later entitlement check reach it through
 * here, taking plain values rather than this module's entity so the domain type
 * never crosses the boundary with it.
 */
export { isServing, servingReason } from "../domain/serving-state.js";
export type { ServingStateInput, ServingReason } from "../domain/serving-state.js";
export { SUBSCRIPTION_STATUSES, canTransition, assertTransition } from "../domain/subscription-status.js";
export type { SubscriptionStatus } from "../domain/subscription-status.js";
export type { SubscriptionDto } from "../application/subscribe-to-plan.input.js";
export { planSubscribeCapability } from "../interfaces/plan-subscribe.capability.js";
export { subscriptionReadCapability } from "../interfaces/subscription-read.capability.js";
