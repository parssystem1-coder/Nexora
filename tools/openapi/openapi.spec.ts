import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocument, serializeDocument, ARTIFACT_PATH } from "./generate.js";
import { CAPABILITIES } from "./capabilities.js";
import { listFiles } from "../conformance/lib/walk.js";
import { httpStatusForCode } from "../../modules/capability/contracts/index.js";

/**
 * ADR-033's verification list, as tests.
 *
 * The stale-artifact case follows ADR-030's standard: a rule is only proven
 * by a deliberately failing fixture, so the drift check is run for real, as
 * a subprocess, against an artifact that has been tampered with - not merely
 * asserted to be "different".
 */

const GENERATE_CLI = join(process.cwd(), "tools", "openapi", "generate.ts");

/** Runs the real CLI against a throwaway copy of the artifact, exactly as CI does. */
function runCheckAgainst(artifact: string): { status: number | null; stderr: string; stdout: string } {
  const dir = mkdtempSync(join(tmpdir(), "nexora-openapi-"));
  try {
    const artifactPath = join(dir, "openapi.json");
    writeFileSync(artifactPath, artifact, "utf8");
    const result = spawnSync(process.execPath, ["--import", "tsx", GENERATE_CLI, "--check"], {
      encoding: "utf8",
      env: {
        ...process.env,
        OPENAPI_ARTIFACT_PATH: artifactPath,
        // ADR-033: "the generator runs with no database reachable." Point every
        // connection string at a closed port, so if the generator ever grew an
        // import that opens a pool this would fail loudly rather than quietly
        // succeeding on a developer machine that happens to have Postgres up.
        DATABASE_URL: "postgresql://nobody:nobody@127.0.0.1:1/nowhere",
        MIGRATE_DATABASE_URL: "postgresql://nobody:nobody@127.0.0.1:1/nowhere",
      },
    });
    return { status: result.status, stderr: result.stderr, stdout: result.stdout };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("OpenAPI artifact (ADR-033)", () => {
  it("the committed artifact matches what the capability definitions and their Zod schemas generate", () => {
    expect(readFileSync(ARTIFACT_PATH, "utf8")).toBe(serializeDocument(buildDocument()));
  });

  it("covers every implemented capability", () => {
    const document = buildDocument() as { paths: Record<string, Record<string, { operationId: string }>> };
    const documented = Object.values(document.paths).flatMap((methods) =>
      Object.values(methods).map((operation) => operation.operationId),
    );

    for (const capability of CAPABILITIES) {
      expect(documented).toContain(capability.id);
    }
    expect(documented).toHaveLength(CAPABILITIES.length);
  });

  it("the registry it generates from lists every *.capability.ts in the tree", () => {
    const capabilityFiles = listFiles(process.cwd(), [".ts"]).filter((file) => file.endsWith(".capability.ts"));
    expect(capabilityFiles.length).toBeGreaterThan(0);

    const declaredIds = new Set(CAPABILITIES.map((capability) => capability.id));
    for (const file of capabilityFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const match = /\bid:\s*"([^"]+)"/.exec(source);
      expect(match, `${file} declares no capability id`).not.toBeNull();
      expect(declaredIds, `${file} is not in tools/openapi/capabilities.ts`).toContain(match![1]);
    }
  });

  it("documents every error code each capability can raise, under the status the HTTP boundary returns", () => {
    const document = buildDocument() as {
      paths: Record<string, Record<string, { operationId: string; responses: Record<string, { description: string }> }>>;
    };

    for (const capability of CAPABILITIES) {
      const operation = Object.values(document.paths)
        .flatMap((methods) => Object.values(methods))
        .find((candidate) => candidate.operationId === capability.id);
      expect(operation, `${capability.id} missing from the document`).toBeDefined();

      for (const code of capability.errorCodes) {
        const status = String(httpStatusForCode(code));
        expect(operation!.responses[status]?.description, `${capability.id} ${code}`).toContain(code);
      }
    }
  });

  it("no hand-written schema: every documented shape comes from a Zod schema on a capability definition", () => {
    // Structural pin for ADR-033 item 1. @ApiProperty (the decorator-based
    // alternative the ADR rejects) must not appear anywhere in the tree.
    const offenders = listFiles(process.cwd(), [".ts"]).filter((file) =>
      readFileSync(join(process.cwd(), file), "utf8").includes("@ApiProperty"),
    );
    expect(offenders).toEqual([]);
  });
});

describe("OpenAPI drift check (ADR-033 item 5)", () => {
  it("passes against the committed artifact, with no database reachable", () => {
    const result = runCheckAgainst(readFileSync(ARTIFACT_PATH, "utf8"));

    expect(result.stderr + result.stdout).toContain("up to date");
    expect(result.status).toBe(0);
  });

  it("fails against a deliberately stale artifact", () => {
    const stale = readFileSync(ARTIFACT_PATH, "utf8").replace('"version": "1"', '"version": "0-stale"');
    expect(stale).not.toBe(readFileSync(ARTIFACT_PATH, "utf8"));

    const result = runCheckAgainst(stale);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("stale");
  });
});
