/**
 * Project graph extractor.
 *
 * Emits a compact, mechanically-derived map of what this repository actually
 * contains: modules and their real dependency edges, tables and their RLS
 * posture, capabilities, routes, platform singletons, the ADR register, and
 * the test inventory by layer.
 *
 * Everything here is PARSED from source, never written by hand and never
 * summarised by a model. That is the whole point: `03` vs `08` vs
 * `DECISION_LOG.md` drifted apart precisely because the description of the
 * system lived in prose that nothing regenerated. A graph that a human or a
 * model maintains by hand would reproduce that failure with a nicer shape.
 *
 * Usage:
 *   npm run graph              regenerate PROJECT_GRAPH.md + project-graph.json
 *   npm run graph -- --check   fail (exit 1) if the committed graph is stale
 *   npm run graph -- --since HEAD~5   structural diff against an earlier commit
 *
 * This is a reporting tool. It asserts nothing and enforces nothing — rules
 * are the conformance harness's job (ADR-030). If a fact here looks wrong,
 * the fix is in the source it was parsed from, not in the output file.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const IGNORE = new Set(["node_modules", ".git", "dist", "coverage", "fixtures"]);

const MD_OUT = join(ROOT, "PROJECT_GRAPH.md");
const JSON_OUT = join(ROOT, "tools", "graph", "project-graph.json");
const JSON_REL = "tools/graph/project-graph.json";

// ---------------------------------------------------------------- utilities

function posix(p: string): string {
  return p.split(sep).join("/");
}

/**
 * Plain UTF-16 code-unit comparison — NOT `String.prototype.localeCompare`.
 * `localeCompare`'s ordering of punctuation (`.`, `_`, `-`, `/`, `:` — exactly
 * what table names, capability ids, routes and singleton roles are full of)
 * depends on the ICU collation data linked into the Node build and the
 * platform's default locale, neither of which this codebase controls or can
 * assume matches between the machine a slice is authored on and the Linux CI
 * runner it is checked on. A default, comparator-less `Array.prototype.sort`
 * over plain strings does not have this problem (ECMA-262 mandates UTF-16
 * code-unit comparison there), so `cmp` gives every OBJECT-keyed sort here
 * that same guarantee explicitly. See DECISION_LOG.md 2026-08-24.
 */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Whether `dir` actually contains at least one file the extractor would
 * otherwise list (recursively — a layer's own subdirectories count). Git
 * does not track empty directories at all, so an empty directory on one
 * machine's checkout (leftover scaffolding, an old branch, a half-finished
 * slice) simply does not exist on any OTHER checkout of the same commit —
 * including CI's. `statSync(...).isDirectory()` alone answers "does this
 * path exist on THIS filesystem", which is a question about the machine,
 * not the repository; this answers "does the repository actually have
 * anything here", which is the question `extractModules` needs answered for
 * both a module and each of its layers. See DECISION_LOG.md 2026-08-24,
 * "a layer with no files is not a layer".
 */
function hasAnyFile(dir: string, ext: string[]): boolean {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (IGNORE.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (hasAnyFile(full, ext)) return true;
    } else if (ext.some((e) => entry.endsWith(e))) {
      return true;
    }
  }
  return false;
}

function listFiles(dir: string, ext: string[]): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (IGNORE.has(entry)) continue;
      const full = join(d, entry);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (ext.some((e) => entry.endsWith(e))) out.push(posix(relative(ROOT, full)));
    }
  };
  walk(dir);
  return out.sort();
}

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

// ------------------------------------------------------------------- shapes

interface ModuleNode {
  name: string;
  layers: string[];
  files: number;
  dependsOn: string[];
  dependsOnPlatform: boolean;
}

interface TableNode {
  name: string;
  module: string;
  migration: string;
  tenantId: boolean;
  rlsEnabled: boolean;
  rlsForced: boolean;
  policies: string[];
}

interface CapabilityNode {
  id: string;
  module: string;
  file: string;
  permissions: string[];
  risk: string;
  audit: boolean;
  storeScoped: boolean;
  route: string;
}

interface AdrNode {
  id: string;
  title: string;
  status: string;
  blocks: string;
}

interface TestNode {
  file: string;
  layer: string;
  cases: number;
}

export interface Graph {
  generatedFrom: { commit: string; dirty: boolean };
  modules: ModuleNode[];
  tables: TableNode[];
  capabilities: CapabilityNode[];
  singletons: { role: string; file: string }[];
  adrs: AdrNode[];
  tests: TestNode[];
  routes: { method: string; path: string; file: string }[];
  counts: Record<string, number>;
}

// ------------------------------------------------------------------ modules

const CODE_EXT = [".ts", ".sql"];

/**
 * Which of `moduleDir`'s immediate subdirectories count as a real layer —
 * one that holds at least one file the extractor would otherwise list, not
 * merely one that happens to exist on this filesystem (2026-08-24: `audit`
 * reported `application`/`interfaces` as layers because both existed as
 * empty leftovers on one machine — see `hasAnyFile`'s comment and
 * DECISION_LOG.md). Exported and factored out specifically so a test can
 * build a fixture directory tree, including a deliberately empty one, and
 * run this exact function against it — the real rule, not a re-description
 * of it.
 */
export function detectLayers(moduleDir: string): string[] {
  return readdirSync(moduleDir)
    .filter((l) => {
      try {
        const layerDir = join(moduleDir, l);
        return statSync(layerDir).isDirectory() && hasAnyFile(layerDir, CODE_EXT);
      } catch {
        return false;
      }
    })
    .sort();
}

function extractModules(): ModuleNode[] {
  const modulesDir = join(ROOT, "modules");
  if (!existsSync(modulesDir)) return [];

  const names = readdirSync(modulesDir).filter((n) => {
    try {
      const dir = join(modulesDir, n);
      return statSync(dir).isDirectory() && !IGNORE.has(n) && hasAnyFile(dir, CODE_EXT);
    } catch {
      return false;
    }
  });

  return names.sort().map((name) => {
    const dir = join(modulesDir, name);
    const layers = detectLayers(dir);

    const files = listFiles(dir, CODE_EXT);
    const deps = new Set<string>();
    let platform = false;

    for (const f of files) {
      if (!f.endsWith(".ts")) continue;
      const src = read(f);
      for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
        const spec = m[1];
        if (!spec || !spec.startsWith(".")) continue;
        const resolved = posix(join(dirname(f), spec));
        const mod = /^modules\/([^/]+)\//.exec(resolved);
        if (mod?.[1] && mod[1] !== name) deps.add(mod[1]);
        if (resolved.startsWith("platform/")) platform = true;
      }
    }

    return {
      name,
      layers,
      files: files.length,
      dependsOn: [...deps].sort(),
      dependsOnPlatform: platform,
    };
  });
}

// ------------------------------------------------------------------- tables

function extractTables(): TableNode[] {
  const sqlFiles = [
    ...listFiles(join(ROOT, "modules"), [".sql"]),
    ...listFiles(join(ROOT, "platform"), [".sql"]),
  ];

  const tables: TableNode[] = [];

  for (const file of sqlFiles) {
    const sql = read(file);
    const moduleMatch = /^modules\/([^/]+)\//.exec(file);
    const module = moduleMatch?.[1] ?? "platform";

    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z_][a-z0-9_]*)"?\s*\(/gi)) {
      const name = m[1];
      if (!name) continue;

      // Body of this CREATE TABLE, for the tenant_id check: from the opening
      // paren to the matching close, so a later table's columns don't leak in.
      const open = sql.indexOf("(", m.index);
      let depth = 0;
      let end = open;
      for (let i = open; i < sql.length; i++) {
        const ch = sql[i];
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const body = sql.slice(open, end);

      const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const policies = [
        ...sql.matchAll(new RegExp(`CREATE\\s+POLICY\\s+([a-z0-9_]+)\\s+ON\\s+"?${esc}"?`, "gi")),
      ]
        .map((p) => p[1])
        .filter((p): p is string => Boolean(p));

      tables.push({
        name,
        module,
        migration: file.split("/").pop() ?? file,
        tenantId: /\btenant_id\b/.test(body),
        rlsEnabled: new RegExp(`ALTER\\s+TABLE\\s+"?${esc}"?\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i").test(sql),
        rlsForced: new RegExp(`ALTER\\s+TABLE\\s+"?${esc}"?\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY`, "i").test(sql),
        policies,
      });
    }
  }

  return tables.sort((a, b) => cmp(a.name, b.name));
}

// ------------------------------------------------- capabilities and routes

function extractRoutes(): { method: string; path: string; file: string }[] {
  const out: { method: string; path: string; file: string }[] = [];
  const files = [
    ...listFiles(join(ROOT, "modules"), [".ts"]),
    ...listFiles(join(ROOT, "apps"), [".ts"]),
  ].filter((f) => f.includes("controller") && !f.endsWith(".spec.ts"));

  for (const file of files) {
    const src = read(file);
    const base = /@Controller\(\s*["']([^"']*)["']/.exec(src)?.[1] ?? "";
    for (const m of src.matchAll(/@(Get|Post|Put|Patch|Delete)\(\s*(?:["']([^"']*)["'])?\s*\)/g)) {
      const method = (m[1] ?? "GET").toUpperCase();
      const sub = m[2] ?? "";
      const path = "/" + [base, sub].filter(Boolean).join("/");
      out.push({ method, path, file });
    }
  }
  return out.sort((a, b) => cmp(a.path, b.path));
}

function extractCapabilities(routes: { method: string; path: string; file: string }[]): CapabilityNode[] {
  const files = listFiles(join(ROOT, "modules"), [".ts"]).filter((f) => f.endsWith(".capability.ts"));
  const out: CapabilityNode[] = [];

  for (const file of files) {
    const src = read(file);
    const id = /\bid:\s*["']([^"']+)["']/.exec(src)?.[1];
    if (!id) continue;

    const permsRaw = /requiredPermissions:\s*\[([^\]]*)\]/.exec(src)?.[1] ?? "";
    const permissions = [...permsRaw.matchAll(/["']([^"']+)["']/g)]
      .map((p) => p[1])
      .filter((p): p is string => Boolean(p));

    const module = /^modules\/([^/]+)\//.exec(file)?.[1] ?? "?";
    // The capability definition itself declares its route (added for ADR-033,
    // which generates OpenAPI from these files). Prefer it: the older
    // "first controller in the same module" heuristic silently gave every
    // capability in a module the same route once a module had more than one.
    // OpenAPI path templating ({storeId}) is rewritten to the Nest form
    // (:storeId) so this column keeps reading like the route table.
    const declaredMethod = /\broute:\s*\{[^{}]*\bmethod:\s*["']([^"']+)["']/.exec(src)?.[1];
    const declaredPath = /\broute:\s*\{[^{}]*\bpath:\s*["']([^"']+)["']/.exec(src)?.[1];
    const route =
      declaredMethod && declaredPath
        ? { method: declaredMethod.toUpperCase(), path: declaredPath.replace(/\{([^}]+)\}/g, ":$1") }
        : routes.find((r) => r.file.startsWith(`modules/${module}/`));

    out.push({
      id,
      module,
      file,
      permissions,
      risk: /\brisk:\s*["']([^"']+)["']/.exec(src)?.[1] ?? "?",
      audit: /\baudit:\s*true/.test(src),
      storeScoped: /\bstoreScoped:\s*true/.test(src),
      route: route ? `${route.method} ${route.path}` : "—",
    });
  }

  return out.sort((a, b) => cmp(a.id, b.id));
}

// --------------------------------------------------------------- singletons

function extractSingletons(): { role: string; file: string }[] {
  const files = [
    ...listFiles(join(ROOT, "platform"), [".ts"]),
    ...listFiles(join(ROOT, "modules"), [".ts"]),
    ...listFiles(join(ROOT, "apps"), [".ts"]),
  ];
  const out: { role: string; file: string }[] = [];
  for (const file of files) {
    for (const m of read(file).matchAll(/@singleton-role:\s*([a-z-]+)/g)) {
      if (m[1]) out.push({ role: m[1], file });
    }
  }
  return out.sort((a, b) => cmp(a.role, b.role));
}

// --------------------------------------------------------------------- ADRs

function extractAdrs(): AdrNode[] {
  const index = "02_ADR_INDEX_NORMATIVE_DECISIONS.md";
  if (!existsSync(join(ROOT, index))) return [];
  const out: AdrNode[] = [];
  const seen = new Set<string>();

  for (const line of read(index).split("\n")) {
    const m = /^\|\s*(ADR-\d+[a-z]?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/.exec(line);
    if (!m) continue;
    const id = m[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: (m[2] ?? "").trim(),
      status: (m[4] ?? "").replace(/\*/g, "").trim(),
      blocks: (m[5] ?? "").trim(),
    });
  }
  return out;
}

// -------------------------------------------------------------------- tests

function layerOf(file: string): string {
  if (file.startsWith("tools/conformance/")) return "conformance";
  if (file.startsWith("platform/")) return "platform";
  if (file.startsWith("apps/")) return "integration";
  const m = /^modules\/[^/]+\/([^/]+)\//.exec(file);
  return m?.[1] ?? "other";
}

function extractTests(): TestNode[] {
  const files = [
    ...listFiles(join(ROOT, "modules"), [".spec.ts"]),
    ...listFiles(join(ROOT, "platform"), [".spec.ts"]),
    ...listFiles(join(ROOT, "apps"), [".spec.ts"]),
    ...listFiles(join(ROOT, "tools"), [".spec.ts"]),
  ];
  return files.map((file) => ({
    file,
    layer: layerOf(file),
    cases: [...read(file).matchAll(/^\s*(?:it|test)(?:\.\w+)?\s*\(/gm)].length,
  }));
}

// -------------------------------------------------------------------- build

function gitInfo(): { commit: string; dirty: boolean } {
  try {
    const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT }).toString().trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT }).toString().trim().length > 0;
    return { commit, dirty };
  } catch {
    return { commit: "unknown", dirty: false };
  }
}

export function build(): Graph {
  const routes = extractRoutes();
  const modules = extractModules();
  const tables = extractTables();
  const capabilities = extractCapabilities(routes);
  const tests = extractTests();
  const adrs = extractAdrs();
  const singletons = extractSingletons();

  return {
    generatedFrom: gitInfo(),
    modules,
    tables,
    capabilities,
    singletons,
    adrs,
    tests,
    routes,
    counts: {
      modules: modules.length,
      tables: tables.length,
      tablesWithRls: tables.filter((t) => t.rlsEnabled).length,
      capabilities: capabilities.length,
      routes: routes.length,
      testFiles: tests.length,
      testCases: tests.reduce((n, t) => n + t.cases, 0),
      adrs: adrs.length,
      adrsAccepted: adrs.filter((a) => a.status.toUpperCase().includes("ACCEPTED")).length,
    },
  };
}

// ------------------------------------------------------------------- render

function yn(b: boolean): string {
  return b ? "yes" : "—";
}

function render(g: Graph): string {
  const L: string[] = [];
  const c = g.counts;

  L.push("# Project Graph");
  L.push("");
  L.push(
    "**Generated** by `npm run graph` from commit `" +
      g.generatedFrom.commit +
      "`" +
      (g.generatedFrom.dirty ? " (working tree dirty)" : "") +
      ". **Do not hand-edit** — every row is parsed from source.",
  );
  L.push("");
  L.push(
    "This file answers *what exists*, cheaply. It does not answer *whether it is correct* — " +
      "that is the conformance harness (ADR-030) and human review. A fact here that looks wrong " +
      "means the source is wrong, not this file.",
  );
  L.push("");
  L.push(
    `**At a glance:** ${c.modules} modules · ${c.tables} tables (${c.tablesWithRls} with RLS) · ` +
      `${c.capabilities} capabilities · ${c.routes} routes · ${c.testCases} test cases in ${c.testFiles} files · ` +
      `${c.adrs} ADRs (${c.adrsAccepted} accepted)`,
  );
  L.push("");

  L.push("## Modules");
  L.push("");
  L.push("| module | layers | files | depends on | platform |");
  L.push("|---|---|---|---|---|");
  for (const m of g.modules) {
    L.push(
      `| \`${m.name}\` | ${m.layers.join(", ") || "—"} | ${m.files} | ` +
        `${m.dependsOn.map((d) => `\`${d}\``).join(", ") || "—"} | ${yn(m.dependsOnPlatform)} |`,
    );
  }
  L.push("");

  L.push("## Tables");
  L.push("");
  L.push("`tenant_id` + RLS + FORCE is required for every tenant-owned table. Exemptions are named in the phase brief §5 — an absent mark here is a fact, not a verdict.");
  L.push("");
  L.push("| table | module | tenant_id | RLS | FORCE | policies | migration |");
  L.push("|---|---|---|---|---|---|---|");
  for (const t of g.tables) {
    L.push(
      `| \`${t.name}\` | ${t.module} | ${yn(t.tenantId)} | ${yn(t.rlsEnabled)} | ${yn(t.rlsForced)} | ` +
        `${t.policies.length ? t.policies.map((p) => `\`${p}\``).join(", ") : "—"} | \`${t.migration}\` |`,
    );
  }
  L.push("");

  L.push("## Capabilities");
  L.push("");
  if (g.capabilities.length === 0) {
    L.push("_None declared._");
  } else {
    L.push("| capability | route | permissions | risk | audit | store-scoped |");
    L.push("|---|---|---|---|---|---|");
    for (const cap of g.capabilities) {
      L.push(
        `| \`${cap.id}\` | \`${cap.route}\` | ${cap.permissions.map((p) => `\`${p}\``).join(", ") || "—"} | ` +
          `${cap.risk} | ${yn(cap.audit)} | ${yn(cap.storeScoped)} |`,
      );
    }
  }
  L.push("");

  L.push("## Platform singletons");
  L.push("");
  L.push("Roles ADR-030 requires exactly one implementation of.");
  L.push("");
  L.push("| role | file |");
  L.push("|---|---|");
  for (const s of g.singletons) L.push(`| \`${s.role}\` | \`${s.file}\` |`);
  L.push("");

  L.push("## Tests by layer");
  L.push("");
  const byLayer = new Map<string, { files: number; cases: number }>();
  for (const t of g.tests) {
    const e = byLayer.get(t.layer) ?? { files: 0, cases: 0 };
    e.files++;
    e.cases += t.cases;
    byLayer.set(t.layer, e);
  }
  L.push("| layer | files | cases |");
  L.push("|---|---|---|");
  for (const [layer, e] of [...byLayer].sort((a, b) => cmp(a[0], b[0]))) L.push(`| ${layer} | ${e.files} | ${e.cases} |`);
  L.push("");
  L.push("<details><summary>Per file</summary>");
  L.push("");
  L.push("| file | layer | cases |");
  L.push("|---|---|---|");
  for (const t of g.tests) L.push(`| \`${t.file}\` | ${t.layer} | ${t.cases} |`);
  L.push("");
  L.push("</details>");
  L.push("");

  L.push("## ADR register");
  L.push("");
  L.push("| ID | Title | Status | Blocks |");
  L.push("|---|---|---|---|");
  for (const a of g.adrs) L.push(`| ${a.id} | ${a.title} | ${a.status} | ${a.blocks} |`);
  L.push("");

  return L.join("\n");
}

// --------------------------------------------------------------------- diff

/**
 * A minimal unified-style diff (LCS-based, no external dependency — this
 * tool has none and one line-level check does not warrant adding one).
 * No context lines or `@@` hunk headers, just `---`/`+++` labels and the
 * `-`/`+` lines that actually differ: enough to say WHAT changed, which is
 * the entire point (`role-catalog-agreement.spec.ts` names the offending key
 * on each side rather than asserting a bare boolean; this is the same move
 * for a generated-file staleness check).
 */
function unifiedDiff(actualLabel: string, actual: string, expectedLabel: string, expected: string): string {
  const a = actual.split("\n");
  const b = expected.split("\n");
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of the longest common suffix of a[i:] and b[j:].
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const lines: string[] = [`--- ${actualLabel}`, `+++ ${expectedLabel}`];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      lines.push(`-${a[i]}`);
      i++;
    } else {
      lines.push(`+${b[j]}`);
      j++;
    }
  }
  while (i < n) {
    lines.push(`-${a[i]}`);
    i++;
  }
  while (j < m) {
    lines.push(`+${b[j]}`);
    j++;
  }
  return lines.join("\n");
}

/** `generatedFrom` legitimately changes every commit — excluded from equality/diff the same way the Markdown's "**Generated**" line is. */
function stripGeneratedFrom(g: Graph): Omit<Graph, "generatedFrom"> {
  const { generatedFrom: _generatedFrom, ...rest } = g;
  return rest;
}

function diffAgainst(ref: string, current: Graph): string {
  let previous: Graph;
  try {
    previous = JSON.parse(execFileSync("git", ["show", `${ref}:${JSON_REL}`], { cwd: ROOT }).toString());
  } catch {
    return `No graph snapshot found at ${ref}:${JSON_REL} — nothing to compare against.\n`;
  }

  const lines: string[] = [`Changes since ${ref} (${previous.generatedFrom.commit} → ${current.generatedFrom.commit}):`, ""];

  const setDiff = (label: string, before: string[], after: string[]) => {
    const added = after.filter((x) => !before.includes(x));
    const removed = before.filter((x) => !after.includes(x));
    for (const a of added) lines.push(`  + ${label}: ${a}`);
    for (const r of removed) lines.push(`  - ${label}: ${r}`);
  };

  setDiff("module", previous.modules.map((m) => m.name), current.modules.map((m) => m.name));
  setDiff("table", previous.tables.map((t) => t.name), current.tables.map((t) => t.name));
  setDiff("capability", previous.capabilities.map((x) => x.id), current.capabilities.map((x) => x.id));
  setDiff("route", previous.routes.map((r) => `${r.method} ${r.path}`), current.routes.map((r) => `${r.method} ${r.path}`));
  setDiff("ADR", previous.adrs.map((a) => `${a.id} (${a.status})`), current.adrs.map((a) => `${a.id} (${a.status})`));
  setDiff(
    "singleton",
    previous.singletons.map((s) => `${s.role} → ${s.file}`),
    current.singletons.map((s) => `${s.role} → ${s.file}`),
  );

  // Dependency edges — a new cross-module edge is architecturally significant.
  const edges = (g: Graph) => g.modules.flatMap((m) => m.dependsOn.map((d) => `${m.name} → ${d}`));
  setDiff("dependency", edges(previous), edges(current));

  // RLS posture changes on tables that exist in both snapshots.
  for (const t of current.tables) {
    const before = previous.tables.find((p) => p.name === t.name);
    if (!before) continue;
    if (before.rlsEnabled !== t.rlsEnabled) lines.push(`  ! table ${t.name}: RLS ${before.rlsEnabled} → ${t.rlsEnabled}`);
    if (before.rlsForced !== t.rlsForced) lines.push(`  ! table ${t.name}: FORCE ${before.rlsForced} → ${t.rlsForced}`);
    if (before.policies.length !== t.policies.length)
      lines.push(`  ! table ${t.name}: policies ${before.policies.length} → ${t.policies.length}`);
  }

  for (const [k, v] of Object.entries(current.counts)) {
    const before = previous.counts[k];
    if (before !== undefined && before !== v) lines.push(`  ~ ${k}: ${before} → ${v}`);
  }

  if (lines.length === 2) lines.push("  (no structural change)");
  lines.push("");
  return lines.join("\n");
}

// --------------------------------------------------------------------- main

function main(): void {
  const args = process.argv.slice(2);
  const graph = build();

  if (args.includes("--check")) {
    let stale = false;

    // The generated-from line carries the commit hash, which legitimately
    // moves every commit; compare everything after it so --check catches real
    // drift instead of flagging every commit as stale by construction.
    const expectedMd = render(graph);
    const actualMd = existsSync(MD_OUT) ? readFileSync(MD_OUT, "utf8") : "";
    const stripGeneratedLine = (s: string) => s.split("\n").filter((l) => !l.startsWith("**Generated**")).join("\n");
    const expectedMdStripped = stripGeneratedLine(expectedMd);
    const actualMdStripped = stripGeneratedLine(actualMd);
    if (expectedMdStripped !== actualMdStripped) {
      console.error(`PROJECT_GRAPH.md is stale:\n`);
      console.error(unifiedDiff("committed PROJECT_GRAPH.md", actualMdStripped, "freshly generated", expectedMdStripped));
      console.error("");
      stale = true;
    }

    // project-graph.json was NOT covered by this check before — an ordering
    // bug (or anything else that changes array order without changing set
    // membership) can drift the JSON's array order while every Markdown table
    // still renders identically, since the Markdown only ever displays what
    // the JSON already decided the order was. Same exclusion for the same
    // legitimately-moving field, applied by omitting it before serializing
    // rather than by filtering rendered lines (there is no stable single line
    // to filter in JSON the way there is in the Markdown).
    const expectedJson = JSON.stringify(stripGeneratedFrom(graph), null, 2);
    const actualJsonRaw = existsSync(JSON_OUT) ? readFileSync(JSON_OUT, "utf8") : "";
    let actualJson = "";
    try {
      actualJson = actualJsonRaw ? JSON.stringify(stripGeneratedFrom(JSON.parse(actualJsonRaw) as Graph), null, 2) : "";
    } catch {
      actualJson = actualJsonRaw; // unparsable committed JSON is itself a diff worth showing verbatim
    }
    if (expectedJson !== actualJson) {
      console.error(`${JSON_REL} is stale:\n`);
      console.error(unifiedDiff(`committed ${JSON_REL}`, actualJson, "freshly generated", expectedJson));
      console.error("");
      stale = true;
    }

    if (stale) {
      console.error("Run `npm run graph` and commit the result.");
      process.exit(1);
    }
    console.log("Project graph: up to date.");
    process.exit(0);
  }

  const sinceIndex = args.indexOf("--since");
  if (sinceIndex !== -1) {
    const ref = args[sinceIndex + 1];
    if (!ref) {
      console.error("--since needs a git ref, e.g. --since HEAD~5");
      process.exit(1);
    }
    process.stdout.write(diffAgainst(ref, graph));
    process.exit(0);
  }

  writeFileSync(MD_OUT, render(graph), "utf8");
  writeFileSync(JSON_OUT, JSON.stringify(graph, null, 2) + "\n", "utf8");
  const c = graph.counts;
  console.log(
    `Project graph written: ${c.modules} modules, ${c.tables} tables, ${c.capabilities} capabilities, ` +
      `${c.routes} routes, ${c.testCases} test cases, ${c.adrs} ADRs.`,
  );
}

// Only act as a CLI when executed directly, so a test can import build()/render()
// (and, deliberately, cmp/unifiedDiff/stripGeneratedFrom) without triggering a
// write to PROJECT_GRAPH.md/project-graph.json as a side effect of the import —
// the same guard tools/openapi/generate.ts already uses for the same reason.
const invokedAs = process.argv[1];
if (invokedAs !== undefined && basename(invokedAs) === "extract.ts" && basename(dirname(invokedAs)) === "graph") {
  main();
}
