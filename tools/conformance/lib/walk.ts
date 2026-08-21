import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// "tools" is excluded because it holds the harness itself and its fixtures
// (tools/conformance/fixtures/**), which are deliberately-broken sample files,
// not product code. Product code lives under modules/ and migrations/ per
// 03_TECHNICAL_BLUEPRINT.md section 2. See DECISION_LOG.md "Harness scan scope".
const ALWAYS_IGNORE = new Set(["node_modules", ".git", "dist", "coverage", "tools"]);

/**
 * Recursively lists files under `root`, returning paths relative to `root`
 * with forward slashes so rules are OS-independent.
 */
export function listFiles(root: string, extensions?: string[]): string[] {
  const out: string[] = [];

  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ALWAYS_IGNORE.has(entry)) continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (!extensions || extensions.some((ext) => entry.endsWith(ext))) {
        out.push(toPosix(relative(root, full)));
      }
    }
  };

  walk(root);
  return out.sort();
}

export function toPosix(p: string): string {
  return p.split(sep).join("/");
}
