// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

/**
 * PHASE_1_DEBT_CLOSURE.md D-4 / DECISION_LOG.md 2026-09-01: `typescript-eslint`
 * with type-aware linting (`recommendedTypeChecked`, not `strictTypeChecked` —
 * a deliberately moderate tier, logged in DECISION_LOG.md alongside the
 * per-rule decisions this file's disables record). `eslint-config-prettier`
 * is last so ESLint never disagrees with Prettier about formatting — Prettier
 * is the only source of style opinions in this repository.
 */
export default tseslint.config(
  {
    ignores: [
      "node_modules",
      "dist",
      // Deliberately-invalid-by-design fixtures for the conformance harness's
      // own self-tests — tsconfig.json already excludes them from type
      // checking for the same reason; a linter flagging them would be a
      // false positive by construction, not a real finding.
      "tools/conformance/fixtures/**",
      // Mechanically generated, each with its own generator and drift check.
      "PROJECT_GRAPH.md",
      "tools/graph/project-graph.json",
      "openapi.json",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // This config file itself is not part of tsconfig.json's `include`
        // (it is tooling config, not application source) — allowDefaultProject
        // lets typescript-eslint parse it without type information rather
        // than erroring that no project covers it.
        projectService: { allowDefaultProject: ["eslint.config.js"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // This codebase's own convention for "destructured/parameter but
      // intentionally unused" (e.g. `const { generatedFrom: _generatedFrom,
      // ...rest } = g;` in tools/graph/extract.ts) predates this linter and
      // is idiomatic across the TS ecosystem — configuring the rule to
      // respect it is the right fix, not renaming working code to satisfy a
      // default the codebase never opted into. See DECISION_LOG.md 2026-09-01.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // DECISION_LOG.md 2026-09-01 "D-4: the no-unsafe-* / require-await
    // decision for test files": 205 of 207 no-unsafe-* findings, and all 95
    // require-await findings, are in *.spec.ts — supertest's `.body` (an
    // HTTP response's parsed JSON) and `App` parameter types are untyped by
    // design, and test fakes/stubs routinely declare `async` to satisfy an
    // interface without needing to `await` anything internally. Fixing
    // either at every call site would mean touching essentially every
    // integration test and application-service spec in this repository —
    // exactly the mass refactor AGENTS.md §4 forbids for a tooling slice —
    // for findings that, if wrong, fail the test itself rather than
    // misbehaving in front of a real user the way the same finding would in
    // production code. Scoped to test files only: production code still
    // gets the full rule set (see the two individually-fixed and two
    // individually-disabled findings this slice's own commit handled in
    // real source).
    files: ["**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
  eslintConfigPrettier,
);
