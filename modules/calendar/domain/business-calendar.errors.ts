/**
 * Pure domain errors, mirroring modules/money's own reasoning (see
 * money.errors.ts): these do NOT extend modules/capability's CapabilityError,
 * which carries an httpStatus — an interface-layer concern this module has
 * no HTTP surface to need. A caller maps these at its own boundary, the same
 * way it maps any other domain failure.
 */

/**
 * Thrown when a caller passes a string that is not a name `Intl.DateTimeFormat`
 * recognizes as an IANA time zone identifier (e.g. "Asia/Tehran"). Checked
 * eagerly rather than left to fail deep inside a conversion, the same
 * reasoning ISO 4217 validation gets in Money.
 */
export class InvalidTimeZoneError extends Error {
  constructor(public readonly timeZone: string) {
    super(`'${timeZone}' is not a recognized IANA time zone identifier.`);
    this.name = "InvalidTimeZoneError";
  }
}
