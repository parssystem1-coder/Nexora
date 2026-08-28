import type { Request } from "express";

/**
 * The single place this codebase derives a client's IP address from a
 * request. Route every caller that needs one through here rather than
 * reading `request.ip` directly — that is the point of this file existing
 * at all: one named place to change once a real deployment topology is
 * known, and one named place to find when reviewing what this API trusts.
 *
 * Same family of problem as ADR-028's `Host` header rule (attacker-
 * controlled input must never be trusted for a security decision without
 * an explicit, verified resolution step): `request.ip` is Express's own
 * resolution of the client address, and its behavior is entirely governed
 * by the app's `trust proxy` setting (`create-app.ts`, `loadTrustProxyConfig`
 * in `platform/config.ts`) — with that setting at its default (`false`,
 * trust nothing), `request.ip` is the raw socket peer address, which is
 * correct with no proxy in front and WRONG (collapses every client to one
 * address) behind one. This function does not — and must not — decide that
 * trust question itself; it only reads whatever Express has already
 * resolved, given however the app was configured to trust (or not trust)
 * a proxy. See `RISK_REGISTER.md` R-012 for why neither the unset nor a
 * carelessly-set `trust proxy` is safe, and the hard trigger for setting it
 * deliberately.
 */
export function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}
