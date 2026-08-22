import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import { extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { httpStatusForCode } from "../../modules/capability/contracts/index.js";
import type { CapabilityDefinition, CapabilityErrorCode } from "../../modules/capability/contracts/index.js";
import { CAPABILITIES } from "./capabilities.js";

/**
 * ADR-033: generates the committed OpenAPI artifact from the Zod schemas
 * that actually validate each capability's input, plus the metadata on its
 * CapabilityDefinition. Nothing describes a contract twice, and nothing here
 * imports a controller, a Nest module or a database connection - the
 * generator runs with no database reachable, which CI depends on.
 *
 *   npm run openapi           regenerate and write openapi.json
 *   npm run openapi -- --check  fail if the committed artifact is stale
 */

extendZodWithOpenApi(z);

/**
 * The committed artifact. `OPENAPI_ARTIFACT_PATH` overrides it so the drift
 * check can be run for real against a deliberately tampered copy
 * (tools/openapi/openapi.spec.ts) without disturbing the committed one.
 */
export const ARTIFACT_PATH = process.env["OPENAPI_ARTIFACT_PATH"] ?? join(process.cwd(), "openapi.json");

/** 05_API_CAPABILITY_CONTRACTS.md §1's stable error envelope. */
const errorEnvelopeSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string().uuid(),
  })
  .openapi("ErrorEnvelope");

/**
 * Splits a capability's one input schema into the path parameters its route
 * declares and the request body that is everything else. Either half may be
 * empty: `store.read` is all path and no body, `organization.create` all body
 * and no path, `membership.invite` both.
 */
function splitInput(capability: CapabilityDefinition): { params?: z.AnyZodObject; body?: z.AnyZodObject } {
  const schema = capability.inputSchema;
  if (!(schema instanceof z.ZodObject)) {
    throw new Error(`Capability ${capability.id} has a non-object inputSchema, which cannot be split into path and body.`);
  }

  const keys = Object.keys(schema.shape as Record<string, unknown>);
  const pathKeys = capability.route.pathParams;
  for (const key of pathKeys) {
    if (!keys.includes(key)) {
      throw new Error(`Capability ${capability.id} declares path parameter "${key}", which its inputSchema does not define.`);
    }
  }

  const bodyKeys = keys.filter((key) => !pathKeys.includes(key));
  const mask = (selected: readonly string[]) => Object.fromEntries(selected.map((key) => [key, true as const]));

  return {
    params: pathKeys.length > 0 ? schema.pick(mask(pathKeys) as never) : undefined,
    body: bodyKeys.length > 0 ? schema.pick(mask(bodyKeys) as never) : undefined,
  };
}

/** Error codes sharing an HTTP status collapse into one documented response for that status. */
function groupErrorsByStatus(codes: readonly CapabilityErrorCode[]): Map<number, CapabilityErrorCode[]> {
  const byStatus = new Map<number, CapabilityErrorCode[]>();
  for (const code of codes) {
    const status = httpStatusForCode(code);
    const existing = byStatus.get(status);
    if (existing) existing.push(code);
    else byStatus.set(status, [code]);
  }
  return new Map([...byStatus.entries()].sort((a, b) => a[0] - b[0]));
}

export function buildDocument(capabilities: readonly CapabilityDefinition[] = CAPABILITIES): unknown {
  const registry = new OpenAPIRegistry();

  registry.registerComponent("securitySchemes", "sessionCookie", {
    type: "apiKey",
    in: "cookie",
    name: "sid",
    description: "Opaque, server-side revocable session token (ADR-029). Set by auth.login.",
  });
  registry.register("ErrorEnvelope", errorEnvelopeSchema);

  for (const capability of capabilities) {
    const { params, body } = splitInput(capability);
    const responses: Record<string, unknown> = {
      [String(capability.route.successStatus)]: {
        description: `${capability.id} succeeded.`,
        content: { "application/json": { schema: capability.outputSchema } },
      },
    };
    for (const [status, codes] of groupErrorsByStatus(capability.errorCodes)) {
      responses[String(status)] = {
        description: codes.join(" | "),
        content: { "application/json": { schema: errorEnvelopeSchema } },
      };
    }

    registry.registerPath({
      method: capability.route.method,
      path: capability.route.path,
      operationId: capability.id,
      summary: `${capability.id} (v${capability.version})`,
      description: [
        `Risk: ${capability.risk}.`,
        `Store-scoped: ${capability.storeScoped}.`,
        `Idempotent: ${capability.idempotent}.`,
        `Audited: ${capability.audit}.`,
        capability.requiredPermissions.length > 0
          ? `Required permissions: ${capability.requiredPermissions.join(", ")}.`
          : "Required permissions: none.",
      ].join(" "),
      security: [{ sessionCookie: [] }],
      request: {
        ...(params ? { params } : {}),
        ...(body ? { body: { required: true, content: { "application/json": { schema: body } } } } : {}),
      },
      responses: responses as never,
    });
  }

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Nexora Platform API",
      version: "1",
      description:
        "Generated from each capability's Zod schemas and CapabilityDefinition (ADR-033). Do not hand-edit - run `npm run openapi`.",
    },
    servers: [{ url: "/" }],
  });
}

export function serializeDocument(document: unknown): string {
  return JSON.stringify(document, null, 2) + "\n";
}

function readCommitted(): string | null {
  try {
    return readFileSync(ARTIFACT_PATH, "utf8");
  } catch {
    return null;
  }
}

/** Returns true when the committed artifact matches what the code would generate right now. */
export function isArtifactCurrent(): boolean {
  return readCommitted() === serializeDocument(buildDocument());
}

function main(): void {
  const generated = serializeDocument(buildDocument());

  if (process.argv.includes("--check")) {
    if (readCommitted() === generated) {
      console.log(`OpenAPI artifact up to date (${CAPABILITIES.length} capabilities).`);
      process.exit(0);
    }
    console.error(
      "OpenAPI artifact is stale: openapi.json differs from what the capability definitions and their Zod schemas generate.\n" +
        "Run `npm run openapi` and commit the result (ADR-033 item 5, 05_API_CAPABILITY_CONTRACTS.md §8).",
    );
    process.exit(1);
  }

  writeFileSync(ARTIFACT_PATH, generated, "utf8");
  console.log(`OpenAPI artifact written: ${ARTIFACT_PATH} (${CAPABILITIES.length} capabilities).`);
}

// Only act as a CLI when executed directly, so the spec can import the pure functions above.
const invokedAs = process.argv[1];
if (invokedAs !== undefined && basename(invokedAs) === "generate.ts" && basename(dirname(invokedAs)) === "openapi") {
  main();
}
