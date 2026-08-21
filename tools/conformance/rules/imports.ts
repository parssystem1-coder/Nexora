import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { listFiles, toPosix } from "../lib/walk.js";
import type { Violation } from "../lib/types.js";

const IMPORT_RE =
  /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g;

const LAYERS = ["domain", "application", "infrastructure", "interfaces", "contracts", "migrations"] as const;
type Layer = (typeof LAYERS)[number];

interface FileLocation {
  module: string | null;
  layer: Layer | null;
}

// modules/<module>/<layer>/...
function locate(path: string): FileLocation {
  const m = /^modules\/([^/]+)\/([^/]+)\//.exec(path);
  if (!m) return { module: null, layer: null };
  const [, moduleName, layerName] = m;
  const layer = layerName && (LAYERS as readonly string[]).includes(layerName) ? (layerName as Layer) : null;
  return { module: moduleName ?? null, layer };
}

// Packages/paths forbidden inside domain/ per ADR-030.
const DOMAIN_FORBIDDEN: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^pg$|^pg-/, label: "pg driver" },
  { pattern: /drizzle/i, label: "query builder (drizzle)" },
  { pattern: /kysely/i, label: "query builder (kysely)" },
  { pattern: /typeorm/i, label: "ORM (typeorm)" },
  { pattern: /prisma/i, label: "ORM (prisma)" },
  { pattern: /^redis$|ioredis/i, label: "redis" },
  { pattern: /^@nestjs\//, label: "NestJS" },
  { pattern: /^next$|^next\//, label: "Next.js" },
  { pattern: /^react$|^react-dom/, label: "React" },
  { pattern: /-sdk$|^@[\w-]+\/.*sdk/i, label: "provider SDK" },
  { pattern: /stripe|twilio|aws-sdk|@aws-sdk\//i, label: "provider SDK" },
];

// Packages forbidden inside the plugin SDK boundary per ADR-030.
const PLUGIN_FORBIDDEN: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^pg$|^pg-/, label: "pg driver" },
  { pattern: /drizzle|kysely|typeorm|prisma/i, label: "ORM / query builder" },
  { pattern: /^redis$|ioredis/i, label: "redis" },
];

const NO_REPOSITORY_MODULES = new Set(["ai", "mcp", "automation", "storefront"]);

function isRelative(spec: string): boolean {
  return spec.startsWith(".") || spec.startsWith("/");
}

function resolveRelative(fromFile: string, spec: string): string {
  const resolved = normalize(join(dirname(fromFile), spec));
  return toPosix(resolved);
}

export function checkImports(root: string): Violation[] {
  const violations: Violation[] = [];
  const files = listFiles(root, [".ts", ".tsx"]);

  for (const file of files) {
    const from = locate(file);
    let source: string;
    try {
      source = readFileSync(join(root, file), "utf8");
    } catch {
      continue;
    }

    for (const match of source.matchAll(IMPORT_RE)) {
      const spec = match[1] ?? match[2];
      if (!spec) continue;

      if (isRelative(spec)) {
        const targetPath = resolveRelative(file, spec);
        const to = locate(targetPath);

        // Rule: domain must not import application/infrastructure/interfaces (own or any module).
        if (from.layer === "domain" && to.layer && ["application", "infrastructure", "interfaces"].includes(to.layer)) {
          violations.push({
            rule: "DEP-DIRECTION-DOMAIN",
            file,
            message: `domain file imports '${spec}' which resolves to the ${to.layer} layer`,
            fix: "Domain must depend on nothing above it. Invert the dependency or move the shared type to domain/.",
          });
        }

        // Rule: application must not import interfaces/infrastructure.
        if (
          from.layer === "application" &&
          to.layer &&
          ["interfaces", "infrastructure"].includes(to.layer)
        ) {
          violations.push({
            rule: "DEP-DIRECTION-APPLICATION",
            file,
            message: `application file imports '${spec}' which resolves to the ${to.layer} layer`,
            fix: "Application may depend only on domain and contracts. Inject infrastructure via a domain-defined interface instead.",
          });
        }

        // Rule: no module may import another module's internals, only its contracts/.
        if (from.module && to.module && from.module !== to.module && to.layer !== "contracts") {
          violations.push({
            rule: "DEP-DIRECTION-CROSS-MODULE",
            file,
            message: `imports '${spec}' directly into module '${to.module}' (layer: ${to.layer ?? "unknown"}) instead of its contracts/`,
            fix: `Import from modules/${to.module}/contracts/index.ts instead.`,
          });
        }

        // Rule: no module may import another module's repository directly (ai/mcp/automation/storefront).
        if (
          from.module &&
          NO_REPOSITORY_MODULES.has(from.module) &&
          /\.repository(\.pg)?$/.test(targetPath.replace(/\.[jt]sx?$/, ""))
        ) {
          violations.push({
            rule: "FORBIDDEN-IMPORT-REPOSITORY",
            file,
            message: `module '${from.module}' imports a repository directly ('${spec}')`,
            fix: "AI, MCP, automation and storefront modules must call an application service via contracts/, never a repository.",
          });
        }
      } else {
        // Bare package import.
        if (from.layer === "domain") {
          const hit = DOMAIN_FORBIDDEN.find((f) => f.pattern.test(spec));
          if (hit) {
            violations.push({
              rule: "FORBIDDEN-IMPORT-DOMAIN",
              file,
              message: `domain file imports '${spec}' (${hit.label})`,
              fix: "Domain must be framework- and infrastructure-free. Move this import to infrastructure/ and depend on an interface from domain/.",
            });
          }
        }

        const isPluginBoundary = file.startsWith("modules/plugin/") || file.startsWith("plugins/");
        if (isPluginBoundary) {
          const hit = PLUGIN_FORBIDDEN.find((f) => f.pattern.test(spec));
          if (hit) {
            violations.push({
              rule: "FORBIDDEN-IMPORT-PLUGIN",
              file,
              message: `plugin-boundary file imports '${spec}' (${hit.label})`,
              fix: "Plugins run outside the trust boundary. Expose the capability through the plugin SDK contract instead.",
            });
          }
        }
      }
    }
  }

  return violations;
}
