/**
 * Pure domain errors. These deliberately do NOT extend
 * modules/capability's CapabilityError: that type carries an httpStatus, which
 * is an interface-layer concern, and Money is a value object with no HTTP
 * surface of its own. A caller that needs to turn one of these into a stable
 * API error maps it at its own boundary, the same way it maps any other
 * domain failure. See DECISION_LOG.md "modules/money layout".
 */

/**
 * ADR-022 item 6: "No arithmetic across currencies. Adding two Money values of
 * different currencies is a domain error, not a conversion."
 */
export class CurrencyMismatchError extends Error {
  constructor(
    public readonly left: string,
    public readonly right: string,
    operation: string,
  ) {
    super(`Cannot ${operation} money in ${left} and ${right}: cross-currency arithmetic is a domain error, not a conversion.`);
    this.name = "CurrencyMismatchError";
  }
}

/** ADR-022 item 1: currency is an ISO 4217 alpha-3 code, uppercase. */
export class InvalidCurrencyCodeError extends Error {
  constructor(public readonly code: string) {
    super(`'${code}' is not a valid ISO 4217 alpha-3 currency code (three uppercase letters).`);
    this.name = "InvalidCurrencyCodeError";
  }
}

/** Raised when an allocation's weights cannot produce a well-defined split. */
export class InvalidAllocationError extends Error {
  constructor(reason: string) {
    super(`Cannot allocate: ${reason}.`);
    this.name = "InvalidAllocationError";
  }
}
