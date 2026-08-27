import type { NextFunction, Request, Response } from "express";

/**
 * The standard response headers every response should carry regardless of
 * outcome — set here rather than by adding `helmet` as a dependency, since
 * this API's actual surface (a JSON API, no HTML rendering, no embedded
 * third-party content) only ever needs this small, stable set; a general
 * hardening library's larger default set (CSP directives, COOP/CORP tuned
 * for cross-origin isolation, etc.) targets a browser-facing HTML app this
 * one is not. Written as plain `res.setHeader` calls so it costs nothing to
 * read or audit.
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  // Legacy header some older browsers still read; explicitly "0" per current
  // guidance (its own heuristic filter can itself be turned into a
  // reflected-content attack) rather than left unset or "1".
  res.setHeader("X-XSS-Protection", "0");
  next();
}
