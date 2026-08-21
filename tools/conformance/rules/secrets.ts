import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../lib/walk.js";
import type { Violation } from "../lib/types.js";

interface Pattern {
  rule: string;
  label: string;
  regex: RegExp;
  /** Extracts the candidate secret value from a match, for placeholder filtering. */
  extractValue?: (matchText: string) => string | null;
}

function quotedLiteralValue(matchText: string): string | null {
  const m = /["'`]([^"'`]+)["'`]/.exec(matchText);
  return m ? m[1]! : null;
}

function afterEqualsValue(matchText: string): string | null {
  const m = /=([^&\s"'`]+)/.exec(matchText);
  return m ? m[1]! : null;
}

const PATTERNS: Pattern[] = [
  {
    rule: "SECRET-AWS-ACCESS-KEY",
    label: "AWS access key id",
    regex: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    rule: "SECRET-PRIVATE-KEY",
    label: "PEM private key block",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    rule: "SECRET-CREDENTIAL-LITERAL",
    label: "credential-shaped literal assignment",
    // Matches assignment-shaped credentials such as an inline Stripe or DB password literal:
    // apiKey = "...", password: '...'.
    regex: /(?:api[_-]?key|secret|password|passwd|token|client[_-]?secret)\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/i,
    extractValue: quotedLiteralValue,
  },
  {
    rule: "SECRET-IN-LOG-OR-SNAPSHOT",
    label: "credential-shaped key=value pair embedded in a larger string (log line, URL, snapshot)",
    // Same keyword list as SECRET-CREDENTIAL-LITERAL, but the key=value pair itself is not a
    // standalone quoted literal — it's embedded inside one, e.g. a captured log line
    // ("... password=hunter2life ...") or a Jest/Vitest .snap file. ADR-030 SECRET RULES:
    // "no secret in a snapshot, fixture or log assertion".
    regex: /\b(?:api[_-]?key|apikey|secret|password|passwd|token|client[_-]?secret)=[^&\s"'`]{8,}/i,
    extractValue: afterEqualsValue,
  },
];

// A literal that is obviously a placeholder is not a real secret.
const PLACEHOLDER_RE = /^(?:changeme|placeholder|xxx+|example|your[-_]?\w+[-_]?here|<[^>]+>|\$\{.*\}|test|fake)$/i;

export function checkSecrets(root: string): Violation[] {
  const violations: Violation[] = [];
  const files = listFiles(root, [
    ".ts",
    ".tsx",
    ".js",
    ".json",
    ".yml",
    ".yaml",
    ".env",
    ".pem",
    ".md",
    ".sql",
    ".snap",
  ]);

  for (const file of files) {
    let source: string;
    try {
      source = readFileSync(join(root, file), "utf8");
    } catch {
      continue;
    }

    for (const pattern of PATTERNS) {
      const match = pattern.regex.exec(source);
      if (!match) continue;

      if (pattern.extractValue) {
        const value = pattern.extractValue(match[0]);
        if (value && PLACEHOLDER_RE.test(value)) continue;
      }

      violations.push({
        rule: pattern.rule,
        file,
        message: `possible ${pattern.label} found`,
        fix: "Remove the literal, rotate the credential if it is real, and load secrets from the platform secret store at runtime only.",
      });
    }
  }

  return violations;
}
