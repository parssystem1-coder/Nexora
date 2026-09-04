// VIOLATION FIXTURE (FORBIDDEN-IMPORT-DOMAIN): ADR-040 rules that logging is a
// port. A domain entity must not reach a logging library directly.
import pino from "pino";

const log = pino();

export class Audited {
  touch(): void {
    log.info("this belongs at an interface or infrastructure boundary, not here");
  }
}
