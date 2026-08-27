import { describe, it, expect } from "vitest";
import {
  getZonedDateTimeParts,
  zonedTimeToInstant,
  addCalendarMonths,
  addCalendarYears,
  addCalendarDays,
  startOfDay,
  dayBoundary,
  compareInstants,
  isWithinHalfOpenInterval,
} from "./business-calendar.js";
import { InvalidTimeZoneError } from "./business-calendar.errors.js";

/**
 * Every DST/offset claim asserted below was independently confirmed against
 * this runtime's own `Intl` time zone database before being written down —
 * see DECISION_LOG.md 2026-08-29 for the probing session. Nothing here is
 * taken on faith from any external claim about a zone's history, including
 * this codebase's own task instructions: one such claim (Iran's DST
 * abolition taking effect from the *start* of 2022) turned out to be wrong
 * against the actual data — Iran's last DST summer was 2022 itself, with
 * abolition only visible from the 2022 autumn fallback onward. The tests
 * below use the dates that actually demonstrate each transition, not the
 * dates first assumed.
 */

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("getZonedDateTimeParts / zonedTimeToInstant round trip", () => {
  it("decomposes a known UTC instant into the correct wall clock in a zone with a positive offset", () => {
    // 2026-06-15T00:00:00Z is 2026-06-15 03:30 in Asia/Tehran (+03:30, no DST since 2022).
    const parts = getZonedDateTimeParts(new Date("2026-06-15T00:00:00.000Z"), "Asia/Tehran");
    expect(parts).toEqual({ year: 2026, month: 6, day: 15, hour: 3, minute: 30, second: 0, millisecond: 0 });
  });

  it("round-trips: decomposing a real instant and reconstructing it returns the original instant", () => {
    const rng = makeRng(0xca1e_0001);
    const zones = ["UTC", "Asia/Tehran", "America/New_York", "Pacific/Kiritimati", "Pacific/Marquesas"];
    for (let i = 0; i < 500; i++) {
      // Sample across roughly 1990-2040 so both DST-observing and post-abolition eras are covered.
      const ms =
        Math.floor(rng() * (new Date("2040-01-01").getTime() - new Date("1990-01-01").getTime())) +
        new Date("1990-01-01").getTime();
      const original = new Date(ms);
      const zone = zones[Math.floor(rng() * zones.length)]!;
      const parts = getZonedDateTimeParts(original, zone);
      const reconstructed = zonedTimeToInstant(parts, zone);
      expect(reconstructed.getTime()).toBe(original.getTime());
    }
  });

  it("rejects a string that Intl does not recognize as an IANA zone", () => {
    expect(() => getZonedDateTimeParts(new Date(), "Mars/Cydonia")).toThrow(InvalidTimeZoneError);
    expect(() =>
      zonedTimeToInstant({ year: 2026, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 }, "not a zone"),
    ).toThrow(InvalidTimeZoneError);
  });
});

describe("DST disambiguation (ADR-031 is silent; policy decided and logged, DECISION_LOG.md 2026-08-29)", () => {
  /**
   * Confirmed against this runtime's tzdata: America/New_York springs
   * forward at exactly 2026-03-08T07:00:00Z (2:00 EST -> 3:00 EDT) and
   * falls back at exactly 2026-11-01T06:00:00Z (2:00 EDT -> 1:00 EST).
   */
  it("a wall-clock time inside a spring-forward gap resolves as if the clock kept running through the gap", () => {
    // 2026-03-08 02:30 America/New_York does not exist (clocks jump 02:00 -> 03:00).
    const resolved = zonedTimeToInstant(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0, millisecond: 0 },
      "America/New_York",
    );
    // 30 minutes past the start of the gap, projected forward: 03:30 EDT = 07:30Z.
    expect(resolved.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("a wall-clock time that occurs twice in a fall-back overlap resolves to the earlier occurrence", () => {
    // 2026-11-01 01:30 America/New_York happens twice: once at 05:30Z (EDT), once at 06:30Z (EST).
    const resolved = zonedTimeToInstant(
      { year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0, millisecond: 0 },
      "America/New_York",
    );
    expect(resolved.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("documents the consequence: the LATER instant of an ambiguous pair does not round-trip through decomposition", () => {
    // The second, later 01:30 (EST, 06:30Z) decomposes to the same wall clock
    // as the first — "01:30" carries no information about which offset was
    // in effect, by construction of wall-clock time itself. Reconstructing
    // from that wall clock deterministically returns the EARLIER instant.
    // This is the documented, correct behavior of the disambiguation policy,
    // not a bug: half-open period math elsewhere in the platform must not
    // assume this round-trips, and this test is what makes that assumption
    // checkable if it is ever violated.
    const laterInstant = new Date("2026-11-01T06:30:00.000Z");
    const parts = getZonedDateTimeParts(laterInstant, "America/New_York");
    expect(parts).toEqual({ year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0, millisecond: 0 });
    const reconstructed = zonedTimeToInstant(parts, "America/New_York");
    expect(reconstructed.toISOString()).toBe("2026-11-01T05:30:00.000Z");
    expect(reconstructed.getTime()).not.toBe(laterInstant.getTime());
  });
});

describe("addCalendarMonths — end-of-month clamping (ADR-031 item 3)", () => {
  it("clamps Jan 31 + 1 month to Feb 28 in a non-leap year", () => {
    const result = addCalendarMonths(new Date("2026-01-31T12:00:00.000Z"), 1, "UTC");
    expect(result.toISOString()).toBe("2026-02-28T12:00:00.000Z");
  });

  it("clamps Jan 31 + 1 month to Feb 29 in a leap year", () => {
    const result = addCalendarMonths(new Date("2028-01-31T12:00:00.000Z"), 1, "UTC");
    expect(result.toISOString()).toBe("2028-02-29T12:00:00.000Z");
  });

  it("clamps Mar 31 + 1 month to Apr 30 (a 30-day month, not the 31st that does not exist)", () => {
    const result = addCalendarMonths(new Date("2026-03-31T12:00:00.000Z"), 1, "UTC");
    expect(result.toISOString()).toBe("2026-04-30T12:00:00.000Z");
  });

  it("does not clamp when the target month is long enough", () => {
    const result = addCalendarMonths(new Date("2026-01-15T12:00:00.000Z"), 1, "UTC");
    expect(result.toISOString()).toBe("2026-02-15T12:00:00.000Z");
  });

  it("crosses a year boundary forward and backward", () => {
    expect(addCalendarMonths(new Date("2026-12-15T00:00:00.000Z"), 1, "UTC").toISOString()).toBe(
      "2027-01-15T00:00:00.000Z",
    );
    expect(addCalendarMonths(new Date("2026-01-15T00:00:00.000Z"), -1, "UTC").toISOString()).toBe(
      "2025-12-15T00:00:00.000Z",
    );
  });

  it("preserves the wall-clock time-of-day across a spring-forward day it lands on", () => {
    // Feb 8 2026, 01:30 EST + 1 month = Mar 8 2026, 01:30 EST — the transition
    // that day happens at 02:00, so 01:30 still exists and is unaffected.
    const start = zonedTimeToInstant(
      { year: 2026, month: 2, day: 8, hour: 1, minute: 30, second: 0, millisecond: 0 },
      "America/New_York",
    );
    const result = addCalendarMonths(start, 1, "America/New_York");
    expect(result.toISOString()).toBe("2026-03-08T06:30:00.000Z"); // 01:30 EST = 06:30Z
  });
});

describe("addCalendarYears — leap-day anniversaries (ADR-024 verification: proven against a leap year)", () => {
  it("clamps a Feb 29 anniversary to Feb 28 in the following non-leap year", () => {
    const result = addCalendarYears(new Date("2028-02-29T09:00:00.000Z"), 1, "UTC");
    expect(result.toISOString()).toBe("2029-02-28T09:00:00.000Z");
  });

  it("lands exactly on Feb 29 again after 4 years", () => {
    const result = addCalendarYears(new Date("2028-02-29T09:00:00.000Z"), 4, "UTC");
    expect(result.toISOString()).toBe("2032-02-29T09:00:00.000Z");
  });

  it("is equivalent to 12x the month arithmetic, not a separately-implemented rule", () => {
    const start = new Date("2026-05-17T14:00:00.000Z");
    expect(addCalendarYears(start, 2, "Asia/Tehran").getTime()).toBe(
      addCalendarMonths(start, 24, "Asia/Tehran").getTime(),
    );
  });

  it("crosses Asia/Tehran's real 2022 DST abolition, re-deriving each year's own actual offset", () => {
    // Confirmed against this runtime's tzdata: 2022-07-15 was still +04:30
    // (Iran's last DST summer); 2023-07-15 is +03:30 (first post-abolition
    // summer). A naive implementation that reused the source offset instead
    // of re-resolving against the target date would get this wrong.
    const summer2022 = zonedTimeToInstant(
      { year: 2022, month: 7, day: 15, hour: 10, minute: 0, second: 0, millisecond: 0 },
      "Asia/Tehran",
    );
    expect(summer2022.toISOString()).toBe("2022-07-15T05:30:00.000Z"); // 10:00 +04:30
    const summer2023 = addCalendarYears(summer2022, 1, "Asia/Tehran");
    expect(summer2023.toISOString()).toBe("2023-07-15T06:30:00.000Z"); // 10:00 +03:30, genuinely different offset
  });

  it("Asia/Tehran is +03:30 year-round today, but had seasonal DST historically — both eras produce correct wall clocks", () => {
    // 2021 (pre-abolition): winter +03:30, summer +04:30.
    expect(
      zonedTimeToInstant(
        { year: 2021, month: 1, day: 15, hour: 12, minute: 0, second: 0, millisecond: 0 },
        "Asia/Tehran",
      ).toISOString(),
    ).toBe("2021-01-15T08:30:00.000Z");
    expect(
      zonedTimeToInstant(
        { year: 2021, month: 7, day: 15, hour: 12, minute: 0, second: 0, millisecond: 0 },
        "Asia/Tehran",
      ).toISOString(),
    ).toBe("2021-07-15T07:30:00.000Z");
    // 2026 (post-abolition): fixed +03:30 in both seasons.
    expect(
      zonedTimeToInstant(
        { year: 2026, month: 1, day: 15, hour: 12, minute: 0, second: 0, millisecond: 0 },
        "Asia/Tehran",
      ).toISOString(),
    ).toBe("2026-01-15T08:30:00.000Z");
    expect(
      zonedTimeToInstant(
        { year: 2026, month: 7, day: 15, hour: 12, minute: 0, second: 0, millisecond: 0 },
        "Asia/Tehran",
      ).toISOString(),
    ).toBe("2026-07-15T08:30:00.000Z");
  });
});

describe("addCalendarDays — grace-period arithmetic (ADR-024 item 4, ADR-031 item 7)", () => {
  it("a 7-day grace period across a fall-back is a real 169 hours, not 168 — the extra hour is not lost", () => {
    const expiry = zonedTimeToInstant(
      { year: 2026, month: 10, day: 29, hour: 0, minute: 0, second: 0, millisecond: 0 },
      "America/New_York",
    );
    const graceEnd = addCalendarDays(expiry, 7, "America/New_York");
    expect(graceEnd.toISOString()).toBe("2026-11-05T05:00:00.000Z"); // Nov 5, 00:00 EST
    expect((graceEnd.getTime() - expiry.getTime()) / 3_600_000).toBe(169);
  });

  it("a 1-day grace period across a spring-forward is a real 23 hours, not 24 — the missing hour is not double-counted", () => {
    const start = zonedTimeToInstant(
      { year: 2026, month: 3, day: 7, hour: 12, minute: 0, second: 0, millisecond: 0 },
      "America/New_York",
    );
    expect(start.toISOString()).toBe("2026-03-07T17:00:00.000Z"); // Mar 7, 12:00 EST (transition is the next day)
    const next = addCalendarDays(start, 1, "America/New_York");
    expect(next.toISOString()).toBe("2026-03-08T16:00:00.000Z"); // Mar 8, 12:00 EDT
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it("in a zone with no DST at all (fixed offset), N days is exactly N*24 hours", () => {
    const start = zonedTimeToInstant(
      { year: 2026, month: 6, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 },
      "Asia/Tehran",
    );
    const later = addCalendarDays(start, 10, "Asia/Tehran");
    expect((later.getTime() - start.getTime()) / 3_600_000).toBe(240);
  });

  it("supports negative days", () => {
    const start = new Date("2026-06-15T12:00:00.000Z");
    expect(addCalendarDays(start, -5, "UTC").toISOString()).toBe("2026-06-10T12:00:00.000Z");
  });
});

describe("startOfDay / dayBoundary (ADR-031 item 4: half-open periods)", () => {
  it("resolves midnight in a positive, fixed-offset zone", () => {
    // 20:00 UTC + 03:30 = 23:30 local — still June 15 in Tehran, so its
    // startOfDay is June 15's own midnight: 00:00 - 03:30 = the previous
    // UTC day at 20:30.
    const instant = new Date("2026-06-15T20:00:00.000Z");
    expect(startOfDay(instant, "Asia/Tehran").toISOString()).toBe("2026-06-14T20:30:00.000Z");
  });

  it("resolves to the gap-policy instant when the zone's own midnight does not exist that day", () => {
    // America/Santiago's 2026 spring-forward is confirmed (via direct Intl
    // probing) to land exactly at local midnight: 2026-09-06T03:59:59Z is
    // 2026-09-05 23:59:59 local, and 2026-09-06T04:00:00Z is already
    // 2026-09-06 01:00:00 local — the entire 00:00-00:59 hour of Sept 6
    // does not exist. `startOfDay` for any instant on that calendar day
    // must therefore return the same "later candidate" resolution every
    // other nonexistent wall-clock time gets, not a literal 00:00:00.000.
    const instant = new Date("2026-09-06T20:00:00.000Z"); // 17:00 local that day
    const result = startOfDay(instant, "America/Santiago");
    expect(result.toISOString()).toBe("2026-09-06T04:00:00.000Z"); // 01:00 local — not 00:00, which never happened
  });

  it("dayBoundary produces a correct half-open [start, end) pair spanning exactly one calendar day", () => {
    const instant = zonedTimeToInstant(
      { year: 2026, month: 6, day: 15, hour: 14, minute: 0, second: 0, millisecond: 0 },
      "Asia/Tehran",
    );
    const { start, end } = dayBoundary(instant, "Asia/Tehran");
    expect(start.toISOString()).toBe("2026-06-14T20:30:00.000Z"); // 2026-06-15 00:00 +03:30
    expect(end.toISOString()).toBe("2026-06-15T20:30:00.000Z"); // 2026-06-16 00:00 +03:30
    expect(isWithinHalfOpenInterval(instant, start, end)).toBe(true);
    expect(isWithinHalfOpenInterval(start, start, end)).toBe(true); // included at start
    expect(isWithinHalfOpenInterval(end, start, end)).toBe(false); // excluded at end
  });

  it("a day boundary spanning a spring-forward is still exactly the calendar day, 23 real hours long", () => {
    const instant = zonedTimeToInstant(
      { year: 2026, month: 3, day: 8, hour: 15, minute: 0, second: 0, millisecond: 0 },
      "America/New_York",
    );
    const { start, end } = dayBoundary(instant, "America/New_York");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });
});

describe("compareInstants / isWithinHalfOpenInterval", () => {
  it("orders instants correctly regardless of which zone produced them", () => {
    const a = zonedTimeToInstant(
      { year: 2026, month: 1, day: 1, hour: 0, minute: 0, second: 0, millisecond: 0 },
      "UTC",
    );
    const b = zonedTimeToInstant(
      { year: 2026, month: 1, day: 1, hour: 3, minute: 30, second: 0, millisecond: 0 },
      "Asia/Tehran",
    ); // = same instant as a
    const c = zonedTimeToInstant(
      { year: 2026, month: 1, day: 2, hour: 0, minute: 0, second: 0, millisecond: 0 },
      "UTC",
    );
    expect(compareInstants(a, b)).toBe(0);
    expect(compareInstants(a, c)).toBe(-1);
    expect(compareInstants(c, a)).toBe(1);
  });

  it("rejects mixing conventions silently: end is excluded, start is included, nothing else is", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-02-01T00:00:00.000Z");
    expect(isWithinHalfOpenInterval(new Date("2026-01-01T00:00:00.000Z"), start, end)).toBe(true);
    expect(isWithinHalfOpenInterval(new Date("2026-01-31T23:59:59.999Z"), start, end)).toBe(true);
    expect(isWithinHalfOpenInterval(new Date("2026-02-01T00:00:00.000Z"), start, end)).toBe(false);
    expect(isWithinHalfOpenInterval(new Date("2025-12-31T23:59:59.999Z"), start, end)).toBe(false);
  });
});
