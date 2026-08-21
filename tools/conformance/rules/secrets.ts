import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listFiles } from "../lib/walk.js";
import type { Violation } from "../lib/types.js";

interface Pattern {
  rule: string;
  label: string;
  regex: RegExp;
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
    // Matches assignment-shaped credentials such as an inline Stripe or DB password literal.
    regex:
      /(?:api[_-]?key|secret|password|passwd|token|client[_-]?secret)\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/i,
  },
];

// A literal that is obviously a placeholder is not a real secret.
const PLACEHOLDER_RE = /^(?:changeme|placeholder|xxx+|example|your[-_]?\w+[-_]?here|<[^>]+>|\$\{.*\}|test|fake)$/i;

function extractLiteralValue(matchText: string): string | null {
  const m = /["'`]([^"'`]+)["'`]/.exec(matchText);
  return m ? m[1]! : null;
}

export function checkSecrets(root: string): Violation[] {
  const violations: Violation[] = [];
  const files = listFiles(root, [".ts", ".tsx", ".js", ".json", ".yml", ".yaml", ".env", ".pem", ".md", ".sql"]);

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

      if (pattern.rule === "SECRET-CREDENTIAL-LITERAL") {
        const value = extractLiteralValue(match[0]);
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
