import { readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { listFiles, toPosix } from "../lib/walk.js";
import type { Violation } from "../lib/types.js";

/**
 * ADR-030's "a rule without a check is documentation, not architecture,"
 * applied to `08_PHASE_1_BRIEF.md` §6's "every error path returns a
 * documented code" — the 2026-08-24 gate review's Finding 2: this was true
 * across all nine capabilities, verified by hand, with nothing stopping a
 * tenth from drifting.
 *
 * Two checks, both mechanical, both bounded by what static source-text
 * scanning can actually see:
 *
 *   ERROR-CODE-UNDOCUMENTED — a capability's own `errorCodes` array names a
 *   code `05_API_CAPABILITY_CONTRACTS.md` §7 does not list at all. Fully
 *   general: the documented set is a fixed list, and a capability file's own
 *   array is fully visible in one file.
 *
 *   ERROR-CODE-UNDECLARED — a `CapabilityError("CODE", ...)` is thrown
 *   somewhere reachable from a capability's controller (the controller
 *   itself, every guard it imports, every application service and
 *   repository those import, transitively) but that code is missing from
 *   the capability's declared `errorCodes`.
 *
 * Reachability is traced by following each visited file's OWN named
 * `import { A, B } from "spec"` lines, resolving each name through any
 * chain of pure re-export barrels (`export { A } from "other"`) to the file
 * that actually implements it, and only then adding that file to the scan
 * queue. This distinction is load-bearing, not cosmetic: a first version of
 * this rule instead visited a barrel's ENTIRE re-export surface whenever
 * anything was imported from it, and produced seven false positives on this
 * repository's real, correct code — e.g. `session.guard.ts` imports only
 * `CapabilityError` from `capability/contracts/index.js`, but that barrel
 * ALSO separately re-exports `resolvePathOrBodyValue` (a different function,
 * in a different file, that throws `VALIDATION_ERROR`) — a naive "visit
 * everything the barrel touches" trace wrongly concluded every capability
 * using `SessionGuard` was reachable to `VALIDATION_ERROR`, when none of
 * them call that function at all. Resolving by name, not by file, is what
 * fixes this: importing `CapabilityError` only ever chains to wherever
 * `CapabilityError` itself is defined, never to a sibling name the same
 * barrel happens to also carry.
 *
 * What this does NOT catch, stated plainly rather than implied away:
 *   - a `CapabilityError` constructed with a non-literal code (a variable,
 *     a template string) — the regex only matches a literal `"CODE"`.
 *   - a code thrown by code reached through anything other than a static
 *     relative `import`/`export ... from` edge (a dynamically resolved
 *     class, a DI token not visible as an import). This codebase's actual
 *     style is `new XService(...)` with a static import at the top of every
 *     controller, so this is not a live gap today, but it is a real edge of
 *     what this check can see.
 *   - once a name resolves to its implementing file, that WHOLE file is
 *     scanned and its OWN imports are followed the same way — this is
 *     correct for this codebase's actual shape (a re-exported name is
 *     either a thin barrel passthrough or genuinely implemented in the file
 *     that stops re-exporting it), but would over-collect again if a single
 *     file ever bundled multiple, unrelated, independently-callable
 *     functions under one export line the way a barrel bundles multiple
 *     files — not a pattern this codebase currently uses, but worth
 *     re-checking if it ever does.
 *   - a capability declaring MORE codes than are ever reachable (over-
 *     declaration relative to what's thrown, as opposed to relative to what
 *     `05` documents) — deliberately not flagged: a capability may
 *     legitimately declare a code for a codepath this static trace cannot
 *     see reach, and flagging that would encourage removing codes to chase
 *     a clean report rather than for a real reason.
 */

const CAPABILITY_ERROR_RE = /CapabilityError\(\s*["']([A-Z_]+)["']/g;
const CAPABILITY_CONST_RE = /export const (\w+)\s*:\s*CapabilityDefinition/;
const CAPABILITY_ID_RE = /\bid:\s*["']([^"']+)["']/;
const ERROR_CODES_ARRAY_RE = /errorCodes:\s*\[([^\]]*)\]/;
const ERROR_CODES_SECTION_RE = /## 7\. Error Codes\s*```text([\s\S]*?)```/;
/** Matches both `import {...} from "spec"` and `export {...} from "spec"` (incl. `type`) — same shape, different keyword. */
const NAMED_FROM_RE = /(import|export)\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"](\.[^'"]+)['"]/g;

interface NamedFromClause {
  keyword: "import" | "export";
  /** local/exposed name -> original name at the target (equal unless aliased with `as`). */
  names: Map<string, string>;
  spec: string;
}

function parseNamedFromClauses(source: string): NamedFromClause[] {
  const out: NamedFromClause[] = [];
  for (const m of source.matchAll(NAMED_FROM_RE)) {
    const keyword = m[1] as "import" | "export";
    const body = m[2] ?? "";
    const spec = m[3]!;
    const names = new Map<string, string>();
    for (const part of body.split(",")) {
      const trimmed = part.replace(/^\s*type\s+/, "").trim();
      if (!trimmed) continue;
      const asMatch = /^(\w+)\s+as\s+(\w+)$/.exec(trimmed);
      if (asMatch) names.set(asMatch[2]!, asMatch[1]!);
      else names.set(trimmed, trimmed);
    }
    out.push({ keyword, names, spec });
  }
  return out;
}

/** `05_API_CAPABILITY_CONTRACTS.md` §7's fenced code list — the base set plus "added in 2.0", since Phase 1 already legitimately reuses one 2.0 code (`DOMAIN_RESERVED`, `store.create`). */
export function extractDocumentedCodes(root: string): Set<string> {
  let text: string;
  try {
    text = readFileSync(join(root, "05_API_CAPABILITY_CONTRACTS.md"), "utf8");
  } catch {
    return new Set();
  }
  const section = ERROR_CODES_SECTION_RE.exec(text)?.[1] ?? "";
  const codes = new Set<string>();
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (/^[A-Z][A-Z0-9_]*$/.test(trimmed)) codes.add(trimmed);
  }
  return codes;
}

function resolveRelativeSourceFile(root: string, fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  let resolved = toPosix(normalize(join(dirname(fromFile), spec)));
  if (resolved.endsWith(".js")) resolved = resolved.slice(0, -3) + ".ts";
  else if (!/\.tsx?$/.test(resolved)) resolved += ".ts";
  return existsSync(join(root, resolved)) ? resolved : null;
}

/** Follows `export { name } from "spec"` passthrough chains until landing on the file that no longer re-exports `name` further — the file that actually implements it. */
function resolveImplementingFile(root: string, file: string, name: string, seen: Set<string>): string {
  const key = `${file}::${name}`;
  if (seen.has(key)) return file;
  seen.add(key);

  let source: string;
  try {
    source = readFileSync(join(root, file), "utf8");
  } catch {
    return file;
  }

  for (const clause of parseNamedFromClauses(source)) {
    if (clause.keyword !== "export") continue;
    const original = clause.names.get(name);
    if (original === undefined) continue;
    const target = resolveRelativeSourceFile(root, file, clause.spec);
    if (target) return resolveImplementingFile(root, target, original, seen);
  }

  return file;
}

/** Every `CapabilityError("CODE"` reachable from `entryFile`: its own text, plus every file each of its named imports resolves to (transitively), following re-export chains by name rather than visiting a barrel's whole surface. */
function collectReachableCodes(root: string, entryFile: string): Set<string> {
  const codes = new Set<string>();
  const visited = new Set<string>();
  const queue = [entryFile];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    let source: string;
    try {
      source = readFileSync(join(root, file), "utf8");
    } catch {
      continue;
    }

    for (const m of source.matchAll(CAPABILITY_ERROR_RE)) {
      if (m[1]) codes.add(m[1]);
    }

    for (const clause of parseNamedFromClauses(source)) {
      if (clause.keyword !== "import") continue;
      const target = resolveRelativeSourceFile(root, file, clause.spec);
      if (!target) continue;
      for (const originalName of clause.names.values()) {
        const implementingFile = resolveImplementingFile(root, target, originalName, new Set());
        if (
          (implementingFile.startsWith("modules/") || implementingFile.startsWith("platform/")) &&
          !visited.has(implementingFile)
        ) {
          queue.push(implementingFile);
        }
      }
    }
  }

  return codes;
}

/** The controller file that actually wires up capability `exportedConstName` — found by which controller references the capability definition's own exported const, not by filename convention (this codebase's own filenames don't agree with each other: store-read.capability.ts / store.controller.ts). */
function findControllerFile(root: string, exportedConstName: string): string | null {
  const controllers = listFiles(root, [".ts"]).filter((f) => f.endsWith(".controller.ts"));
  const nameRe = new RegExp(`\\b${exportedConstName}\\b`);
  for (const file of controllers) {
    let source: string;
    try {
      source = readFileSync(join(root, file), "utf8");
    } catch {
      continue;
    }
    if (nameRe.test(source)) return file;
  }
  return null;
}

export function checkErrorCodeContract(root: string, documentedCodes?: Set<string>): Violation[] {
  const violations: Violation[] = [];
  const documented = documentedCodes ?? extractDocumentedCodes(root);
  const capabilityFiles = listFiles(root, [".ts"]).filter((f) => f.endsWith(".capability.ts"));

  for (const file of capabilityFiles) {
    let source: string;
    try {
      source = readFileSync(join(root, file), "utf8");
    } catch {
      continue;
    }

    const constMatch = CAPABILITY_CONST_RE.exec(source);
    const idMatch = CAPABILITY_ID_RE.exec(source);
    const arrMatch = ERROR_CODES_ARRAY_RE.exec(source);
    if (!constMatch || !idMatch || !arrMatch) continue;

    const constName = constMatch[1]!;
    const capabilityId = idMatch[1]!;
    const declared = new Set([...(arrMatch[1] ?? "").matchAll(/["']([^"']+)["']/g)].map((m) => m[1]!));

    for (const code of declared) {
      if (!documented.has(code)) {
        violations.push({
          rule: "ERROR-CODE-UNDOCUMENTED",
          file,
          message: `capability '${capabilityId}' declares errorCodes entry '${code}', which 05_API_CAPABILITY_CONTRACTS.md §7 does not list`,
          fix: `Add '${code}' to 05_API_CAPABILITY_CONTRACTS.md §7, or remove it from this capability's errorCodes if it can never actually occur.`,
        });
      }
    }

    const controllerFile = findControllerFile(root, constName);
    if (!controllerFile) continue;
    const reachable = collectReachableCodes(root, controllerFile);
    for (const code of reachable) {
      if (!declared.has(code)) {
        violations.push({
          rule: "ERROR-CODE-UNDECLARED",
          file: controllerFile,
          message: `'${code}' is thrown somewhere reachable from capability '${capabilityId}' but is missing from ${file}'s errorCodes`,
          fix: `Add '${code}' to ${file}'s errorCodes array, or confirm this throw is genuinely unreachable for this capability.`,
        });
      }
    }
  }

  return violations;
}
