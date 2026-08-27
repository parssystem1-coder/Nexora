import { InvalidTimeZoneError } from "./business-calendar.errors.js";

/**
 * ADR-031's calendar/timezone half of `06_IMPLEMENTATION_PLAN.md` Phase 1
 * item 5 ("clock abstraction AND timezone helpers") — the clock abstraction
 * itself is `platform/clock.ts`, built in Task 1; this is the other half,
 * closed later as Phase 1 debt (`PHASE_1_DEBT_CLOSURE.md` D-1).
 *
 * Every function here is a PURE, STATELESS transformation: it takes an
 * explicit instant (a `Date`, always read as a UTC point in time — ADR-031
 * item 1) and an explicit IANA time zone identifier, and returns a new
 * instant or a plain value. None of them ever call `Date.now()` or construct
 * `new Date()` with no arguments — ADR-031 item 6 ("application code obtains
 * time from an injected clock, never a direct system call") is satisfied by
 * construction: a caller gets "now" from its injected `Clock`
 * (`platform/clock.ts`) and hands the result in here as `instant`. This file
 * has no dependency on `Clock` for exactly that reason — there is nothing
 * for it to inject.
 *
 * ADR-031 item 5: "Calendar display is a presentation concern... Domain and
 * Application operate exclusively on instants." Every function below
 * returns and accepts instants, never a calendar-string representation.
 * Rendering an instant in any calendar system (Jalali, for a Nexora UI —
 * see DECISION_LOG.md 2026-08-29) is deliberately out of this file's reach:
 * it belongs at the interface/storefront edge, once one exists, operating
 * on a `Date` this module already produced. See DECISION_LOG.md 2026-08-29
 * for the invariant this establishes: no calendar conversion may appear
 * inside a billing or boundary computation.
 *
 * PLACEMENT (`DECISION_LOG.md` 2026-08-29): this is `modules/calendar/`, not
 * `platform/calendar.ts`. `platform/` is deliberately kept thin — "no domain
 * concepts, no module-specific code" (DECISION_LOG.md 2026-08-22) — and
 * these functions encode real, ADR-031-specified domain rules (end-of-month
 * clamping, half-open periods, DST disambiguation), exactly the reason
 * `modules/money` is a module and not a `platform/money.ts` file despite
 * being just as cross-cutting. `platform/clock.ts`'s `Clock` interface is
 * correctly platform-level: it is a bare infrastructure seam (a testing
 * substitution point for "what time is it"), with no domain semantics of
 * its own.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (err) {
    if (err instanceof RangeError) throw new InvalidTimeZoneError(timeZone);
    throw err;
  }
  formatterCache.set(timeZone, formatter);
  return formatter;
}

/** The wall-clock calendar date and time an instant reads as in a given time zone. */
export interface ZonedDateTimeParts {
  year: number;
  /** 1-12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

/**
 * Decomposes `instant` into the wall-clock date/time it reads as in
 * `timeZone`. This is the one place `Intl.DateTimeFormat` is used to go
 * instant -> wall clock; `zonedTimeToInstant` below is its inverse.
 */
export function getZonedDateTimeParts(instant: Date, timeZone: string): ZonedDateTimeParts {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)!.value);
  const hour24 = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Intl's h23 cycle can still emit "24" for midnight on some ICU versions; normalize to 0.
    hour: hour24 === 24 ? 0 : hour24,
    minute: get("minute"),
    second: get("second"),
    // Milliseconds pass through unaffected by time zone (every IANA zone's
    // modern offset is a whole number of seconds), so they are read directly
    // off the instant rather than through Intl, which does not report them.
    millisecond: instant.getUTCMilliseconds(),
  };
}

/** `parts` read as if it were already a UTC wall clock — an intermediate value, not a public instant. */
function asIfUtcMs(parts: ZonedDateTimeParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, parts.millisecond);
}

function partsEqual(a: ZonedDateTimeParts, b: ZonedDateTimeParts): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second &&
    a.millisecond === b.millisecond
  );
}

/**
 * The inverse of `getZonedDateTimeParts`: finds the UTC instant whose
 * wall-clock reading in `timeZone` is exactly `desired`.
 *
 * Algorithm: guess an instant by naively reading `desired` as if it were
 * already UTC, then correct the guess by the difference between the desired
 * wall clock and the wall clock the current guess actually produces in
 * `timeZone`, and correct once more from there. This is the standard
 * technique for wall-clock <-> instant conversion without a Temporal-shaped
 * API (Node 24 does not yet expose a global `Temporal` — confirmed
 * empirically, not assumed — see DECISION_LOG.md 2026-08-29's dependency
 * decision).
 *
 * Two corrections converge exactly for the overwhelming majority of calls —
 * any moment not inside a DST transition. `desired` naming a moment inside a
 * transition is the one case with no single correct answer, and it is
 * exactly the case the two corrections disagree on: an EARLIER attempt to
 * make this deterministic by iterating a fixed loop count and simply
 * stopping was fragile (a spring-forward gap has no fixed point at all, so
 * the guess oscillates between exactly two candidates forever, and which
 * one a fixed iteration count returns is a parity accident, not a policy —
 * caught by this file's own tests, not shipped). The two candidates below
 * (`candidateA`, `candidateB`) are exactly that oscillating pair when they
 * differ, and are inspected directly rather than trusted to have converged:
 *
 * DST disambiguation (ADR-031 does not specify this — logged as a silence
 * in DECISION_LOG.md 2026-08-29, resolved there rather than picked
 * silently here):
 *   - a wall-clock time that does NOT exist (a "spring forward" gap):
 *     neither candidate decomposes back to `desired` — resolved to the
 *     LATER candidate, i.e. as if the clock had kept running through the
 *     gap. Verified against the actual America/New_York 2026-03-08
 *     transition in this file's own tests.
 *   - a wall-clock time that occurs TWICE (a "fall back" overlap): both
 *     candidates decompose back to `desired` — resolved to the EARLIER
 *     candidate, the offset in effect immediately before the transition.
 *     Verified against the actual America/New_York 2026-11-01 transition —
 *     though in practice an overlap converges to a single candidate after
 *     the first correction already (proven by that same test), so this
 *     branch exists as an explicit, tested fallback rather than something
 *     any known zone's data actually reaches.
 *
 * This is exactly ECMAScript Temporal's `disambiguation: "compatible"`
 * default — confirmed against the actual behavior documented for
 * `Temporal.ZonedDateTime.from` (MDN, 2026-08-29 check), not assumed: "for
 * non-existent times, 'compatible' is equivalent to 'later'"; "for
 * ambiguous times, 'compatible' is equivalent to 'earlier'". The match
 * matters beyond validating the choice: it means the future migration this
 * file's dependency decision (DECISION_LOG.md 2026-08-29) anticipates —
 * swapping this hand-rolled conversion for a native `Temporal` once Node
 * exposes one — is behavior-preserving by default, not a silent semantic
 * change a migrator would need to special-case. Whoever performs that
 * migration should still re-verify this claim against whatever Temporal
 * implementation actually ships, rather than trust this comment indefinitely.
 */
export function zonedTimeToInstant(desired: ZonedDateTimeParts, timeZone: string): Date {
  // Validate the zone up front so a bad identifier fails here, not on some
  // later formatToParts call several corrections deep.
  formatterFor(timeZone);

  const desiredMs = asIfUtcMs(desired);

  const observedA = getZonedDateTimeParts(new Date(desiredMs), timeZone);
  const candidateA = desiredMs + (desiredMs - asIfUtcMs(observedA));

  const observedB = getZonedDateTimeParts(new Date(candidateA), timeZone);
  const candidateB = candidateA + (desiredMs - asIfUtcMs(observedB));

  // Provably safe to return candidateA here without the partsEqual check
  // every other branch below performs, FOR EVERY CALL SITE IN THIS FILE:
  // `candidateA === candidateB` holds iff `asIfUtcMs(observedB) ===
  // desiredMs` (by construction of candidateB above), and `asIfUtcMs`
  // (`Date.UTC`) is injective over canonical, in-range calendar tuples — so
  // that equality implies `observedB` and `desired` are the same tuple,
  // i.e. exactly what `partsEqual` would have checked. This requires
  // `desired` itself to be canonical (year/month/day/hour/etc. each within
  // their normal range), which holds for every call in this file:
  // `getZonedDateTimeParts`'s own output is always canonical (Intl
  // guarantees it), and `addCalendarMonths`/`addCalendarDays`/`startOfDay`
  // each construct `desired` from canonical, explicitly-clamped fields —
  // never from an unvalidated caller input. It would NOT hold for a
  // hypothetical direct external caller of this exported function passing
  // an out-of-range tuple (e.g. `day: 32`), since `Date.UTC` silently
  // normalizes such input rather than rejecting it, which could coincide
  // with a canonical `observedB` under `asIfUtcMs` while still differing
  // from `desired` field-by-field. Not guarded against here, deliberately:
  // this codebase validates a caller-supplied STRING shape at a boundary
  // (`InvalidTimeZoneError`, above) the same way `Money` validates its
  // currency code, but — also like `Money`, which does not range-check
  // `amountMinor` — trusts a caller-supplied NUMBER to already be a sane
  // domain value rather than defensively re-validating it, per this
  // project's "trust internal code" boundary convention. No caller passes
  // a non-canonical tuple today.
  if (candidateA === candidateB) return new Date(candidateA);

  const validA = partsEqual(getZonedDateTimeParts(new Date(candidateA), timeZone), desired);
  const validB = partsEqual(getZonedDateTimeParts(new Date(candidateB), timeZone), desired);
  if (validA && !validB) return new Date(candidateA);
  if (validB && !validA) return new Date(candidateB);
  if (validA && validB) return new Date(Math.min(candidateA, candidateB)); // overlap: earlier wins
  return new Date(Math.max(candidateA, candidateB)); // gap: later wins (push forward)
}

function daysInMonth(year: number, month1to12: number): number {
  // Day 0 of the following month is the last day of this one — plain
  // calendar math, deliberately not timezone-aware (a month's length does
  // not depend on where you observe it from).
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

/**
 * ADR-031 item 3: "A one-month term is the same day-of-month in the next
 * month with documented end-of-month clamping... `+30 days` is prohibited
 * for terms." Preserves the wall-clock time-of-day in `timeZone`; only the
 * calendar date moves. `months` may be negative.
 *
 * Clamping: if the source day-of-month does not exist in the target month
 * (e.g. the 31st, into a 30-day month), the result is the target month's
 * LAST day, at the same time-of-day — e.g. Jan 31 + 1 month = Feb 28 (Feb
 * 29 in a leap year).
 */
export function addCalendarMonths(instant: Date, months: number, timeZone: string): Date {
  const parts = getZonedDateTimeParts(instant, timeZone);
  const totalMonths = parts.year * 12 + (parts.month - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (((totalMonths % 12) + 12) % 12) + 1;
  const targetDay = Math.min(parts.day, daysInMonth(targetYear, targetMonth));
  return zonedTimeToInstant({ ...parts, year: targetYear, month: targetMonth, day: targetDay }, timeZone);
}

/**
 * ADR-031 item 3: "A one-year term is the same date next year." Implemented
 * as 12x the month arithmetic above so the two share one clamping rule —
 * ADR-024's own verification item ("a one-year term expires exactly at its
 * calendar boundary... proven against a leap year") is exactly month
 * clamping applied to a Feb 29 anniversary. `years` may be negative.
 */
export function addCalendarYears(instant: Date, years: number, timeZone: string): Date {
  return addCalendarMonths(instant, years * 12, timeZone);
}

/**
 * Adds whole calendar days in `timeZone`, preserving wall-clock
 * time-of-day — this is what a grace period (ADR-024 item 4: "Default
 * grace window: 7 days") must use, not raw millisecond addition: a grace
 * window stated as "N days" means N calendar days on the wall clock, which
 * is not always N*24 hours across a DST transition (ADR-031 item 7). `days`
 * may be negative.
 */
export function addCalendarDays(instant: Date, days: number, timeZone: string): Date {
  const parts = getZonedDateTimeParts(instant, timeZone);
  // The calendar date arithmetic itself is zone-independent (a calendar
  // date plus N days is the same answer everywhere); only the final
  // wall-clock -> instant resolution needs the zone.
  const advancedDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return zonedTimeToInstant(
    {
      ...parts,
      year: advancedDate.getUTCFullYear(),
      month: advancedDate.getUTCMonth() + 1,
      day: advancedDate.getUTCDate(),
    },
    timeZone,
  );
}

/**
 * The instant that reads as `00:00:00.000` on `instant`'s own calendar day
 * in `timeZone` — EXCEPT in a zone whose DST transition falls exactly at
 * midnight, where `00:00:00.000` on that specific day does not exist
 * (confirmed against real data: America/Santiago's spring-forward jumps
 * directly from `23:59:59.999` the previous day to `01:00:00.000`, skipping
 * its transition day's midnight entirely). On that one day, this correctly
 * returns `zonedTimeToInstant`'s gap-policy answer instead — the same
 * "later candidate" resolution every other caller of a nonexistent
 * wall-clock time gets, not a special case carved out here. Covered by a
 * dedicated test using America/Santiago's actual 2026 transition, not just
 * asserted from this comment.
 */
export function startOfDay(instant: Date, timeZone: string): Date {
  const parts = getZonedDateTimeParts(instant, timeZone);
  return zonedTimeToInstant(
    { year: parts.year, month: parts.month, day: parts.day, hour: 0, minute: 0, second: 0, millisecond: 0 },
    timeZone,
  );
}

/**
 * ADR-031 item 4: "Periods are half-open: `[period_start, period_end)`."
 * The boundary of the calendar day `instant` falls on, in `timeZone`, as
 * exactly that half-open pair — `end` is the following day's `startOfDay`,
 * never "23:59:59.999", which would misstate the boundary by however many
 * milliseconds separate it from the true instant it's approximating.
 */
export function dayBoundary(instant: Date, timeZone: string): { start: Date; end: Date } {
  const start = startOfDay(instant, timeZone);
  return { start, end: addCalendarDays(start, 1, timeZone) };
}

/** Total ordering on instants: -1 if `a` is earlier, 1 if later, 0 if identical. */
export function compareInstants(a: Date, b: Date): -1 | 0 | 1 {
  const diff = a.getTime() - b.getTime();
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

/**
 * ADR-031 item 4's half-open convention, as one shared, tested predicate —
 * "mixing conventions across modules is prohibited," which a convention
 * enforced only by prose in each caller cannot actually prevent. `instant`
 * is within `[start, end)`: included at `start`, excluded at `end`.
 */
export function isWithinHalfOpenInterval(instant: Date, start: Date, end: Date): boolean {
  return compareInstants(instant, start) >= 0 && compareInstants(instant, end) < 0;
}
