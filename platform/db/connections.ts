import type { Kysely } from "kysely";
import { createDb } from "./kysely.js";
import { loadDbConfig } from "../config.js";
import type { Database } from "./kysely.js";

/**
 * The DI tokens and factories for the app's two connection pools (ADR-021
 * item 6: "the application maintains its own pool"). Lives in platform/,
 * not apps/api/, because guards and controllers inside modules/ need
 * `@Inject(APP_DB)` — a module cannot import from apps/api without inverting
 * the dependency direction (apps/api composes modules, modules must not
 * depend on apps/api).
 *
 * Before this, three files each called createDb(loadDbConfig()) at module
 * scope — three independent pools as a side effect of importing a module,
 * multiplying with every guard/controller Task 2 adds. Now there are
 * exactly two, both created once (in apps/api/app.module.ts's provider
 * registration) and injected via explicit tokens — Symbols, not
 * implicit type-based injection, since esbuild does not emit
 * emitDecoratorMetadata (DECISION_LOG.md, "NestJS's type-based constructor
 * DI silently fails...").
 *
 * Two pools, not one: APP_DB serves the request pipeline (steps 1-7);
 * AUDIT_DB is dedicated to durable audit writes (step 8), which must
 * complete on a connection independent of whatever domain transaction is in
 * flight on APP_DB — see DECISION_LOG.md's audit-placement entries. A
 * dedicated pool also means a burst of domain transactions cannot starve
 * audit writes of a connection, and vice versa.
 */
export const APP_DB = Symbol("APP_DB");
export const AUDIT_DB = Symbol("AUDIT_DB");

export function createAppDb(): Kysely<Database> {
  return createDb(loadDbConfig());
}

export function createAuditDb(): Kysely<Database> {
  return createDb(loadDbConfig());
}
