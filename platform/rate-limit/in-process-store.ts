import type { Clock } from "../clock.js";
import type { RateLimitPolicy } from "./policy.js";
import type { RateLimitStore } from "./store.js";

interface WindowState {
  windowStart: number;
  count: number;
}

/**
 * Fixed-window counter, per key, held in a plain in-process `Map`. Time
 * comes from the injected `Clock` (ADR-031 item 6), never `Date.now()`
 * directly, so window boundaries and reset behavior are deterministically
 * testable (see this module's own `.spec.ts`).
 *
 * Fixed-window, not sliding-window or token-bucket: the known trade-off is
 * up to roughly 2x the nominal rate right at a window boundary
 * (`maxAttempts` just before it rolls over, `maxAttempts` again just after)
 * — accepted deliberately here. A login throttle's goal is blunting
 * sustained brute-forcing, not precisely bounding worst-case burst; a
 * sliding-window or token-bucket algorithm would close that gap at real
 * implementation and test cost this task's scope does not call for.
 *
 * Honest limits, named because they matter, not glossed over
 * (decisions/2026-08.md, this date): this store is per-PROCESS state in a
 * plain `Map` — it does not hold across multiple instances of this API
 * behind a load balancer (each instance enforces its own, independent
 * count), and it resets to empty on every process restart. Both are
 * acceptable for closing RISK_REGISTER.md R-005's single-instance gap now;
 * neither is acceptable once this API ever runs as more than one instance.
 * **Hard, checkable trigger for replacing this with a Redis-backed store**
 * (the `redis` service already exists in `docker-compose.yml`,
 * `PHASE_1_DEBT_CLOSURE.md` D-2): the same trigger D-2 itself named for
 * BullMQ — when `06_IMPLEMENTATION_PLAN.md` Phase 2 work first deploys more
 * than one running instance of this API, or sooner if load-balancing
 * multiple instances is deliberately brought forward. Whoever hits that
 * trigger swaps this class for a Redis-backed `RateLimitStore` behind the
 * same interface; nothing above `platform/rate-limit/store.ts` needs to
 * change.
 */
export class InProcessRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, WindowState>();

  constructor(private readonly clock: Clock) {}

  isBlocked(key: string, policy: RateLimitPolicy): boolean {
    const state = this.windows.get(key);
    if (!state) return false;
    if (this.clock.now().getTime() - state.windowStart >= policy.windowMs) return false;
    return state.count >= policy.maxAttempts;
  }

  recordAttempt(key: string, policy: RateLimitPolicy): void {
    const nowMs = this.clock.now().getTime();
    const state = this.windows.get(key);
    if (!state || nowMs - state.windowStart >= policy.windowMs) {
      this.windows.set(key, { windowStart: nowMs, count: 1 });
      return;
    }
    state.count += 1;
  }
}
