import { readFileSync, existsSync } from "node:fs";
import type { Violation } from "./types.js";

export interface Exception {
  rule: string;
  file: string;
  reason: string;
  adr: string;
}

const ADR_REF_RE = /^ADR-\d{3}$/;

export interface ExceptionsOutcome {
  suppressed: Array<Violation & { reason: string; adr: string }>;
  remaining: Violation[];
  /** Exceptions.json entries that are malformed (missing ADR ref) — always a CI failure. */
  invalidEntries: Exception[];
}

export function loadExceptions(path: string): Exception[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) throw new Error(`${path} must be a JSON array`);
  return raw as Exception[];
}

export function applyExceptions(violations: Violation[], exceptions: Exception[]): ExceptionsOutcome {
  const invalidEntries = exceptions.filter((e) => !ADR_REF_RE.test(e.adr ?? ""));

  const suppressed: ExceptionsOutcome["suppressed"] = [];
  const remaining: Violation[] = [];

  for (const violation of violations) {
    const match = exceptions.find((e) => e.rule === violation.rule && e.file === violation.file);
    if (match && ADR_REF_RE.test(match.adr ?? "")) {
      suppressed.push({ ...violation, reason: match.reason, adr: match.adr });
    } else {
      remaining.push(violation);
    }
  }

  return { suppressed, remaining, invalidEntries };
}
