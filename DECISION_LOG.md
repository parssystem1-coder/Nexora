# Decision Log

Per `AGENTS.md` section 5: when an implementer is uncertain, the ambiguity is written here with options and a recommendation instead of being silently resolved. Newest entries at the top.

Template for a new entry:

```
## YYYY-MM-DD — <short title>

**Context:** what document or task raised the ambiguity, and why the docs pack doesn't settle it.
**Options considered:** A, B, C with tradeoffs.
**Decision:** what was picked and why.
**Status:** OPEN (needs human review) | RESOLVED
```

---

## 2026-08-22 — Harness scan scope excludes `tools/`

**Context:** ADR-030 requires the conformance harness to scan "the" source tree, but doesn't say whether the harness's own implementation code and its self-test fixtures (which are *deliberately* broken) count as scannable source. Scanning them naively produced false positives — the harness's own documentation comments matched the exact patterns they were documenting (e.g. a comment illustrating the secret-literal pattern was itself flagged as a secret; a comment illustrating the singleton marker syntax was itself flagged as a singleton claim).
**Options considered:**
  A. Scan everything including `tools/`, and hand-tune every comment in the harness to never resemble a violation.
  B. Exclude `tools/` (harness code + fixtures) from the real-tree scan; rely on ordinary code review for the harness itself, since it isn't product code.
  C. Move fixtures outside `tools/` (e.g. top-level `__conformance_fixtures__/`) and scan `tools/conformance/rules|lib|run.ts` normally.
**Decision:** B. Product code lives under `modules/` and `migrations/` per `03_TECHNICAL_BLUEPRINT.md` §2; the harness itself is tooling, not a module, and is reviewed by hand. This keeps the harness's own comments free to use realistic examples without fighting its own detectors. Implemented in `tools/conformance/lib/walk.ts` (`ALWAYS_IGNORE` includes `"tools"`).
**Status:** RESOLVED. Revisit if `tools/` ever grows product-adjacent code that should be covered (e.g. a shared CLI other modules depend on).

## 2026-08-22 — Singleton-rule enforcement mechanism

**Context:** ADR-030 requires "exactly one" implementation for five roles (idempotency, tenant-context, serving-state, money-allocator, host-resolution) but does not specify how a mechanical check identifies which file *is* the implementation of a given role, since file names will vary by module and convention (`03_TECHNICAL_BLUEPRINT.md` §2.1 only fixes suffixes like `.service.ts`, `.repository.ts`, not semantic role).
**Options considered:**
  A. Naming convention (e.g. exactly one file matching `**/idempotency/application/*.service.ts`) — brittle, breaks the moment a legitimate second file in that module needs the same suffix.
  B. Explicit marker comment (`@singleton-role: idempotency`) that the implementer adds to the one file that fulfils the role — greppable, explicit, survives refactors and renames.
  C. Static analysis of exported symbol names/interfaces implemented — most accurate but far more implementation effort than Phase 0 warrants.
**Decision:** B, implemented in `tools/conformance/rules/singleton.ts`. Recommend keeping this convention when the golden path and later slices are implemented — the first real idempotency/tenant-context/serving-state/money-allocator/host-resolution file each needs the marker comment added, or the harness will report zero claimants (informational only right now, not a failure, since nothing is built yet) rather than catching a future accidental duplicate.
**Status:** RESOLVED, but the *convention itself* (marker comments) is a judgment call worth a human sanity check before Task 1 starts, since it's not named anywhere in the docs pack.

## 2026-08-22 — Custom checker instead of dependency-cruiser

**Context:** ADR-030 §3 names `dependency-cruiser` or ESLint boundary rules as example tooling for import-direction checks, but says "choice of tool is free; the checks are not."
**Options considered:**
  A. `dependency-cruiser` with a rules config — standard, well-tested, but the cross-module rule ("module A may import module B's `contracts/` only") needs a from/to comparison keyed on a *captured* module name from the `from` side, which is awkward without cross-field backreferences in the OSS rule DSL.
  B. ESLint + a custom `import/no-restricted-paths`-style plugin — similar limitation, plus adds ESLint as a dependency this repo doesn't otherwise need yet.
  C. A small, fully-owned TypeScript checker (regex-based import extraction + path classification) covering direction, forbidden imports, and cross-module in one place.
**Decision:** C, implemented in `tools/conformance/rules/imports.ts`. Revisit once real code volume makes hand-rolled import scanning too slow or too inaccurate — dependency-cruiser remains a reasonable migration target for the direction/forbidden-import rules specifically (not the cross-module or singleton rules, which would still need custom code).
**Status:** RESOLVED for Phase 0. Known limitation: import resolution is regex/source-text based, not the TS compiler API, so `tsconfig` path aliases and barrel re-exports are not fully resolved. No false negatives observed yet because no real code exists to test against; re-evaluate once the golden path lands real imports.
