export interface Violation {
  /** Stable rule identifier, e.g. "DEP-DIRECTION-01". Matched against exceptions.json. */
  rule: string;
  /** File path relative to the scanned root, forward-slashed. */
  file: string;
  /** Human-readable explanation naming the offending import/column/pattern. */
  message: string;
  /** What the implementer should do instead. */
  fix: string;
}

export interface RuleResult {
  ruleSet: string;
  violations: Violation[];
}
