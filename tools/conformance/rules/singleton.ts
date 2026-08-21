import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../lib/walk.js";
import type { Violation } from "../lib/types.js";

/**
 * Singleton rules (ADR-030) are enforced via an explicit marker comment rather than
 * a naming convention, because file names will vary across modules while the
 * architectural claim "this is THE idempotency implementation" must be greppable
 * and unambiguous. See DECISION_LOG.md "Singleton-rule enforcement mechanism".
 *
 * A qualifying file carries a marker comment: the "at" symbol, "singleton-role",
 * a colon, and one of the role names below (e.g. idempotency) — deliberately not
 * written out verbatim here so this file does not trip its own detector.
 */
const MARKER_RE = /@singleton-role:\s*([a-z-]+)/g;

const REQUIRED_ROLES = [
  "idempotency",
  "tenant-context",
  "serving-state",
  "money-allocator",
  "host-resolution",
] as const;

export function checkSingletons(root: string): Violation[] {
  const violations: Violation[] = [];
  const files = listFiles(root, [".ts", ".tsx"]);
  const owners = new Map<string, string[]>();

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(join(root, file), "utf8");
    } catch {
      continue;
    }
    for (const match of source.matchAll(MARKER_RE)) {
      const role = match[1];
      if (!role) continue;
      if (!owners.has(role)) owners.set(role, []);
      owners.get(role)!.push(file);
    }
  }

  for (const role of REQUIRED_ROLES) {
    const files = owners.get(role) ?? [];
    if (files.length > 1) {
      for (const file of files) {
        violations.push({
          rule: "SINGLETON-DUPLICATE",
          file,
          message: `role '${role}' is claimed by ${files.length} files: ${files.join(", ")}`,
          fix: `Exactly one file may carry '@singleton-role: ${role}'. Remove the duplicate implementation and route callers through the surviving one.`,
        });
      }
    }
  }

  for (const [role, files] of owners) {
    if (!(REQUIRED_ROLES as readonly string[]).includes(role)) {
      for (const file of files) {
        violations.push({
          rule: "SINGLETON-UNKNOWN-ROLE",
          file,
          message: `'@singleton-role: ${role}' is not a recognized role`,
          fix: `Use one of: ${REQUIRED_ROLES.join(", ")}.`,
        });
      }
    }
  }

  return violations;
}
