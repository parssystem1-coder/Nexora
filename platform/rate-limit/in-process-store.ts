import type { Clock } from "../clock.js";
import type { RateLimitPolicy } from "./policy.js";
import type { RateLimitStore } from "./store.js";

interface WindowState {
  windowStart: number;
  /**
   * The `windowMs` a policy had when this entry was created or last renewed
   * — captured here, not re-read from whatever policy a later call happens
   * to pass, so this entry's own expiry is self-contained and answerable
   * without any external input. That is what makes eviction (below)
   * possible at all: a sweep has no policy of its own to consult.
   */
  windowMs: number;
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
 * Eviction (decisions/2026-08.md, this date — closing a defect found in this
 * store's first version, not part of the original design): every
 * `recordAttempt` call — the only method that can ever grow `windows`,
 * since `isBlocked` is a pure read — first sweeps every entry whose window
 * has already expired. This bounds the map to roughly "distinct keys that
 * recorded a failure within the last `windowMs`", not "distinct keys ever
 * seen since this process started" — a key that is never touched again is
 * removed the next time ANY key is recorded, not retained forever. Chosen
 * over two named alternatives, deliberately, not by default:
 *   - A periodic timer (`setInterval`) — rejected. It would need `.unref()`
 *     to avoid holding the process alive on its own, and, more importantly,
 *     firing on real wall-clock time is fundamentally at odds with this
 *     store's own testability goal: a test drives time by calling the fake
 *     `Clock`'s `advance()`, which a real timer never observes, so proving
 *     eviction under simulated time would need a SECOND, parallel
 *     time-control mechanism (faked Node timers) alongside the Clock this
 *     store already uses — two ways to fake time in one test is exactly
 *     the kind of accidental complexity worth avoiding.
 *   - A bounded map with an LRU-style eviction policy (evict the least-
 *     recently-touched entry once a size cap is hit) — rejected. It bounds
 *     memory by entry COUNT regardless of whether an evicted entry's window
 *     is still active, which can silently undo the throttle itself: under a
 *     high-cardinality attack (many distinct identifiers/IPs at once), a
 *     genuinely still-blocked key could be evicted to make room for a new
 *     one, and its next attempt would wrongly read as fresh. A sweep only
 *     ever removes entries whose window has ACTUALLY elapsed, so it can
 *     never weaken the guarantee this store exists to provide.
 * Full-map sweep, not a partial/rotating one, chosen for the same reason:
 * `Map`'s iteration order is insertion order, and renewing an existing key
 * (`.set()` on a key already present) does not move it — so "oldest by
 * position" is not the same as "least recently active," and a partial sweep
 * from one end could skip long-lived, still-expired entries indefinitely.
 * A full sweep is simply correct; at this endpoint's actual traffic shape
 * (login attempts, not a high-QPS path, and `recordAttempt` specifically
 * runs only on a FAILED attempt), its cost is proportional to how many
 * distinct keys failed within one window, which is what this defect needed
 * bounded in the first place — not a new, separate scaling concern.
 *
 * Honest limits, named because they matter, not glossed over
 * (decisions/2026-08.md): this store is per-PROCESS state in a plain `Map`
 * — it does not hold across multiple instances of this API behind a load
 * balancer (each instance enforces its own, independent count), and it
 * resets to empty on every process restart. Both are acceptable for closing
 * RISK_REGISTER.md R-005's single-instance gap now; neither is acceptable
 * once this API ever runs as more than one instance.
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

  /** Introspection only — how many keys are currently retained. Used by this class's own eviction test, and available for future operational visibility (e.g. a metrics/health surface). Never used to make a throttling decision. */
  get size(): number {
    return this.windows.size;
  }

  isBlocked(key: string, policy: RateLimitPolicy): boolean {
    const state = this.windows.get(key);
    if (!state) return false;
    if (this.isExpired(state, this.clock.now().getTime())) return false;
    return state.count >= policy.maxAttempts;
  }

  recordAttempt(key: string, policy: RateLimitPolicy): void {
    const nowMs = this.clock.now().getTime();
    this.sweepExpired(nowMs);

    const state = this.windows.get(key);
    if (!state || this.isExpired(state, nowMs)) {
      this.windows.set(key, { windowStart: nowMs, windowMs: policy.windowMs, count: 1 });
      return;
    }
    state.count += 1;
  }

  private isExpired(state: WindowState, nowMs: number): boolean {
    return nowMs - state.windowStart >= state.windowMs;
  }

  /** Removes every entry whose own window has elapsed. See this class's own doc comment for why this runs here, in full, rather than as a timer or a partial/LRU sweep. */
  private sweepExpired(nowMs: number): void {
    for (const [key, state] of this.windows) {
      if (this.isExpired(state, nowMs)) this.windows.delete(key);
    }
  }
}
