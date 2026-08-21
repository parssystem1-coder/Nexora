import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { checkImports } from "./rules/imports.js";
import { checkSingletons } from "./rules/singleton.js";
import { checkSchema } from "./rules/schema.js";
import { checkSecrets } from "./rules/secrets.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => join(HERE, "fixtures", name);

/**
 * Self-test of the conformance harness itself: proves each ADR-030 check
 * actually detects the violation it claims to, and that a correctly
 * structured tree produces zero false positives. This suite is what CI
 * runs alongside `npm run conformance` — it does NOT scan real product
 * code (that's run.ts's job).
 */

describe("dependency direction", () => {
  it("flags a domain file importing application/", () => {
    const violations = checkImports(fixture("dep-direction-domain"));
    expect(violations.map((v) => v.rule)).toContain("DEP-DIRECTION-DOMAIN");
  });

  it("flags an application file importing infrastructure/", () => {
    const violations = checkImports(fixture("dep-direction-application"));
    expect(violations.map((v) => v.rule)).toContain("DEP-DIRECTION-APPLICATION");
  });

  it("flags one module reaching into another module's internals", () => {
    const violations = checkImports(fixture("dep-direction-cross-module"));
    expect(violations.map((v) => v.rule)).toContain("DEP-DIRECTION-CROSS-MODULE");
  });
});

describe("forbidden imports", () => {
  it("flags domain importing a DB driver", () => {
    const violations = checkImports(fixture("forbidden-import-domain"));
    expect(violations.map((v) => v.rule)).toContain("FORBIDDEN-IMPORT-DOMAIN");
  });

  it("flags the plugin boundary importing redis", () => {
    const violations = checkImports(fixture("forbidden-import-plugin"));
    expect(violations.map((v) => v.rule)).toContain("FORBIDDEN-IMPORT-PLUGIN");
  });

  it("flags an ai/mcp/automation/storefront module importing a repository directly", () => {
    const violations = checkImports(fixture("forbidden-import-repository"));
    expect(violations.map((v) => v.rule)).toContain("FORBIDDEN-IMPORT-REPOSITORY");
  });
});

describe("singleton rules", () => {
  it("flags two files claiming the same singleton role", () => {
    const violations = checkSingletons(fixture("singleton-duplicate"));
    expect(violations.map((v) => v.rule)).toContain("SINGLETON-DUPLICATE");
    expect(violations.length).toBe(2); // both claimants are reported
  });
});

describe("schema rules", () => {
  it("flags a tenant-owned table with no tenant_id", () => {
    const violations = checkSchema(fixture("schema-missing-tenant-id"));
    expect(violations.map((v) => v.rule)).toContain("SCHEMA-MISSING-TENANT-ID");
  });

  it("flags a tenant-owned table with no RLS policy", () => {
    const violations = checkSchema(fixture("schema-missing-rls"));
    expect(violations.map((v) => v.rule)).toContain("SCHEMA-MISSING-RLS");
  });

  it("flags a FLOAT column on a monetary field", () => {
    const violations = checkSchema(fixture("schema-float-money"));
    expect(violations.map((v) => v.rule)).toContain("SCHEMA-FLOAT-MONEY-COLUMN");
  });

  it("flags a second, module-local idempotency table", () => {
    const violations = checkSchema(fixture("schema-duplicate-idempotency-table"));
    expect(violations.map((v) => v.rule)).toContain("SCHEMA-DUPLICATE-IDEMPOTENCY-TABLE");
  });
});

describe("secret rules", () => {
  it("flags an AWS access key literal", () => {
    const violations = checkSecrets(fixture("secret-aws-key"));
    expect(violations.map((v) => v.rule)).toContain("SECRET-AWS-ACCESS-KEY");
  });

  it("flags a PEM private key block", () => {
    const violations = checkSecrets(fixture("secret-private-key"));
    expect(violations.map((v) => v.rule)).toContain("SECRET-PRIVATE-KEY");
  });

  it("flags a hardcoded credential-shaped literal", () => {
    const violations = checkSecrets(fixture("secret-credential-literal"));
    expect(violations.map((v) => v.rule)).toContain("SECRET-CREDENTIAL-LITERAL");
  });

  it("flags a credential embedded in a snapshot/log line, not just a standalone literal", () => {
    const violations = checkSecrets(fixture("secret-in-log-snapshot"));
    expect(violations.map((v) => v.rule)).toContain("SECRET-IN-LOG-OR-SNAPSHOT");
  });
});

describe("clean control tree", () => {
  it("produces zero violations across every rule set", () => {
    const root = fixture("clean");
    expect(checkImports(root)).toEqual([]);
    expect(checkSingletons(root)).toEqual([]);
    expect(checkSchema(root)).toEqual([]);
    expect(checkSecrets(root)).toEqual([]);
  });
});
