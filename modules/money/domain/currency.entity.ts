/**
 * A currency as domain code is allowed to see it: the code and its minor-unit
 * exponent, nothing else.
 *
 * ADR-022 item 4 ("display is not storage") is enforced structurally here.
 * The currencies table also stores a presentation code, divisor and symbol,
 * but this entity deliberately does not carry them, so no domain or
 * application code can reach a presentation unit even by accident. Formatting
 * for display is an interface-layer concern and reads that configuration
 * directly at that boundary.
 */
export class Currency {
  constructor(
    /** ISO 4217 alpha-3, uppercase. */
    public readonly code: string,
    public readonly name: string,
    /** The minor-unit exponent: 0 for IRR/JPY, 2 for USD/EUR, 3 for KWD. */
    public readonly minorUnits: number,
  ) {}
}
