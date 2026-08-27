import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard for the defect decisions/2026-08.md ("A real build path... no
 * devDependency import in dist/") found and fixed: apps/api/create-app.ts
 * statically imported @nestjs/testing (a devDependency), so `npm ci
 * --omit=dev` broke `npm start` even though `npm run build` compiled clean —
 * a compile pass proves nothing about which package.json section an import
 * resolved from. This scans the real, already-built dist/ for any
 * import/require specifier naming a package listed in package.json's
 * devDependencies, so the same class of defect fails CI immediately after
 * the Build step, on the actual emitted output, rather than being caught (or
 * missed) only when someone happens to test a production install by hand.
 *
 * Deliberately a plain script, not a full ADR-030 conformance rule: every
 * other rule in that harness proves itself against a committed fixture that
 * simulates a violation in source; this check's subject is a *build
 * artifact*, not source, so a fixture would only prove the regex works, not
 * that dist/ itself is clean — the real dist/ this script scans already is
 * the only fixture that matters. See decisions/2026-08.md for the full
 * argument and the case for revisiting this if it ever needs a second use.
 */

const DIST_DIR = "dist";

function readPackageJson(): { devDependencies?: Record<string, string> } {
  return JSON.parse(readFileSync("package.json", "utf8")) as { devDependencies?: Record<string, string> };
}

function listJsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listJsFiles(full));
    } else if (full.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

/** The bare package name an import specifier resolves against in node_modules — scoped packages keep their scope segment. */
function toBarePackageName(specifier: string): string {
  const segments = specifier.split("/");
  return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : (segments[0] ?? specifier);
}

const IMPORT_SPECIFIER_PATTERN =
  /(?:from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)|require\(\s*["']([^"']+)["']\s*\))/g;

function findDevDependencyImports(file: string, devDependencyNames: ReadonlySet<string>): string[] {
  const source = readFileSync(file, "utf8");
  const violations: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier === undefined) continue;
    if (devDependencyNames.has(toBarePackageName(specifier))) {
      violations.push(specifier);
    }
  }
  return violations;
}

function main(): void {
  let hasDistDir: boolean;
  try {
    hasDistDir = statSync(DIST_DIR).isDirectory();
  } catch {
    hasDistDir = false;
  }
  if (!hasDistDir) {
    console.error(`"${DIST_DIR}/" does not exist — run \`npm run build\` before this check.`);
    process.exit(1);
  }

  const devDependencyNames = new Set(Object.keys(readPackageJson().devDependencies ?? {}));
  const violations: Array<{ file: string; specifier: string }> = [];

  for (const file of listJsFiles(DIST_DIR)) {
    for (const specifier of findDevDependencyImports(file, devDependencyNames)) {
      violations.push({ file, specifier });
    }
  }

  if (violations.length > 0) {
    console.error(
      `${DIST_DIR}/ imports ${violations.length} devDependency reference(s) — this build would fail under \`npm ci --omit=dev\`:`,
    );
    for (const { file, specifier } of violations) {
      console.error(`  ${file} imports "${specifier}"`);
    }
    process.exit(1);
  }

  console.log(`OK: no file under ${DIST_DIR}/ imports a devDependency.`);
}

main();
