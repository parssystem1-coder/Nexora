import { describe, it, expect } from "vitest";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, detectLayers } from "./extract.js";

/**
 * A platform-dependent bug in this exact file (2026-08-24): four fields were
 * sorted with `String.prototype.localeCompare`, whose collation of `.`, `_`,
 * `-`, `/` and `:` — exactly what table names, capability ids, routes and
 * singleton roles are built from — depends on the ICU data linked into the
 * Node build and the platform's default locale. It agreed with plain
 * codepoint order on the Windows machine this repository was authored on and
 * disagreed on the Linux CI runner, so `npm run graph -- --check` passed
 * locally and failed in CI for a month before anyone could tell why (see
 * DECISION_LOG.md 2026-08-24). Neither of the tests below would have caught
 * that failure by running THIS test suite on Linux specifically — the whole
 * point is that nobody develops on Linux here, so a bug like that returns
 * unless it is made structurally impossible rather than merely "not observed
 * yet on the one platform anyone runs tests on."
 */

describe("project graph extractor: platform-independent determinism", () => {
  it("never sorts with localeCompare - its collation is locale/ICU-dependent, unlike plain codepoint comparison", () => {
    const source = readFileSync(join(process.cwd(), "tools", "graph", "extract.ts"), "utf8");
    expect(source).not.toContain(".localeCompare(");
  });

  it("building the graph twice in the same process yields byte-identical output (generatedFrom excluded, since it legitimately never repeats)", () => {
    const strip = (g: ReturnType<typeof build>) => {
      const { generatedFrom: _generatedFrom, ...rest } = g;
      return JSON.stringify(rest, null, 2);
    };

    expect(strip(build())).toBe(strip(build()));
  });

  it("every collection that reaches the artifact is already in plain codepoint order", () => {
    const graph = build();
    const isSorted = (values: string[]) => values.every((v, i) => i === 0 || values[i - 1]! <= v);

    expect(isSorted(graph.tables.map((t) => t.name))).toBe(true);
    expect(isSorted(graph.routes.map((r) => r.path))).toBe(true);
    expect(isSorted(graph.capabilities.map((c) => c.id))).toBe(true);
    expect(isSorted(graph.singletons.map((s) => s.role))).toBe(true);
    expect(isSorted(graph.modules.map((m) => m.name))).toBe(true);
  });
});

/**
 * 2026-08-24: `PROJECT_GRAPH.md` reported `audit`'s layers as `application,
 * contracts, domain, infrastructure, interfaces, migrations` since this file
 * was first written — `application/` and `interfaces/` existed only as empty
 * leftovers from Phase 0 scaffolding on the machine this repo is developed
 * on. Git does not track empty directories at all, so a fresh checkout (CI's,
 * anyone else's) never had them; only `npm run graph -- --check` running on
 * such a checkout could ever have surfaced the gap between what the artifact
 * claimed and what the repository actually contained, which is exactly why
 * it took CI's first real run to find it (DECISION_LOG.md 2026-08-24, "a
 * layer with no files is not a layer").
 *
 * The fixture is built at test time, deliberately, rather than committed:
 * git cannot store an empty directory as a fixture, which is itself part of
 * what made the original bug invisible until now.
 */
describe("project graph extractor: an empty layer directory is not a layer", () => {
  it("reports a layer that holds a file, and omits a layer directory that holds none", () => {
    const moduleDir = mkdtempSync(join(tmpdir(), "nexora-graph-module-"));
    try {
      mkdirSync(join(moduleDir, "contracts"));
      writeFileSync(join(moduleDir, "contracts", "index.ts"), "export {};\n", "utf8");
      mkdirSync(join(moduleDir, "interfaces")); // empty - exactly audit's shape before the fix

      const layers = detectLayers(moduleDir);

      expect(layers).toContain("contracts");
      expect(layers).not.toContain("interfaces");
      expect(layers).toEqual(["contracts"]);
    } finally {
      rmSync(moduleDir, { recursive: true, force: true });
    }
  });

  it("still counts a layer whose only file is nested in a subdirectory", () => {
    const moduleDir = mkdtempSync(join(tmpdir(), "nexora-graph-module-"));
    try {
      mkdirSync(join(moduleDir, "migrations"));
      mkdirSync(join(moduleDir, "migrations", "nested"));
      writeFileSync(join(moduleDir, "migrations", "nested", "20260824000000_thing.sql"), "-- noop\n", "utf8");

      expect(detectLayers(moduleDir)).toEqual(["migrations"]);
    } finally {
      rmSync(moduleDir, { recursive: true, force: true });
    }
  });
});
