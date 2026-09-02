import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkRegister, countCells, REGISTER_PATH } from "./check-register.js";

/**
 * ADR-030's standard, applied to a check that deliberately lives outside the
 * conformance harness (see `check-register.ts`'s own doc comment for why):
 * *"each listed check has a deliberately failing fixture proving the check
 * works."* A rule nobody has watched fail is not a rule.
 *
 * Four fixtures, because three of them would not be enough:
 *   - one per real defect mechanism the register has actually suffered,
 *   - a clean one, without which a check that rejects EVERYTHING also looks
 *     like it works,
 *   - and a vacuity fixture, which is the failure ADR-043 names explicitly: a
 *     parser that silently matches nothing is a check that always passes.
 */
const FIXTURES = join(process.cwd(), "tools/register/fixtures");
const fixture = (name: string): string => readFileSync(join(FIXTURES, `${name}.md`), "utf8");

describe("register integrity — cell counting", () => {
  it("counts a well-formed row as eight cells", () => {
    expect(countCells("| R-001 | a | b | c | d | e | f | g |")).toBe(8);
  });

  it("counts an escaped pipe as content, not as a delimiter", () => {
    expect(countCells("| R-001 | `a \\| b` | b | c | d | e | f | g |")).toBe(8);
  });

  it("counts an unescaped pipe as a delimiter, which is the defect", () => {
    expect(countCells("| R-001 | `a | b` | b | c | d | e | f | g |")).toBe(9);
  });
});

describe("register integrity — the rule fails on each real defect", () => {
  it("passes on a clean register", () => {
    expect(checkRegister(fixture("clean"))).toEqual([]);
  });

  it("fails on a row with an unescaped pipe (nine cells)", () => {
    const violations = checkRegister(fixture("nine-cells"));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe("REGISTER-ROW-CELLS");
    expect(violations[0]?.message).toContain("renders 9 cells, expected 8");
    // The message must say what the reader loses, not merely that a count is off.
    expect(violations[0]?.message).toContain("invisible in every rendered view");
  });

  it("fails on a row split across two physical lines", () => {
    const violations = checkRegister(fixture("split-row"));
    expect(violations.map((v) => v.rule)).toContain("REGISTER-ROW-LINES");
    expect(violations.find((v) => v.rule === "REGISTER-ROW-LINES")?.message).toContain("terminates the table");
  });

  it("fails loudly when the row pattern matches nothing — the vacuous pass ADR-043 warns about", () => {
    const violations = checkRegister(fixture("no-rows-matched"));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe("REGISTER-HEADER");
    expect(violations[0]?.message).toContain("below the floor");
  });

  it("fails when the header row is missing", () => {
    const violations = checkRegister(fixture("clean").replace(/^\| ID \| Risk .*$/m, "| Nope |"));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toBe("REGISTER-HEADER");
    expect(violations[0]?.message).toContain("No register header row found");
  });

  it("fails when the delimiter row beneath the header is missing", () => {
    const violations = checkRegister(fixture("clean").replace("|---|---|---|---|---|---|---|---|", "not a delimiter"));
    expect(violations.map((v) => v.rule)).toContain("REGISTER-HEADER");
    expect(violations.some((v) => v.message.includes("not the table delimiter row"))).toBe(true);
  });
});

describe("register integrity — the real file", () => {
  it("RISK_REGISTER.md is intact", () => {
    expect(checkRegister(readFileSync(join(process.cwd(), REGISTER_PATH), "utf8"))).toEqual([]);
  });
});
