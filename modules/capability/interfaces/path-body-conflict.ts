import { CapabilityError } from "../contracts/index.js";
import type { CapabilityRoute } from "../contracts/index.js";

/**
 * A shared controller/guard concern, not a `modules/tenant` one: any module
 * whose route mixes an explicit path parameter with a request body needs
 * the same rule, and `modules/capability` is where the other cross-cutting
 * interfaces-layer piece (`http-exception.filter.ts`) already lives.
 * `modules/tenant/interfaces` would make every future module import a
 * generic pipeline utility from a domain module that has nothing to do with
 * it.
 *
 * The rule (recorded in DECISION_LOG.md "A path parameter is authoritative;
 * a differing body value is rejected, not silently overridden"):
 * `08_PHASE_1_BRIEF.md` §5 requires a resource id to be an explicit input,
 * and ADR-002 requires it never be inferred. Two explicit inputs disagreeing
 * is neither — it is an ambiguity the server must not resolve silently in
 * whichever direction an object literal happens to spread last. A path
 * parameter is authoritative because it is what the URL — and therefore
 * every log line, guard decision and audit `resource_id` derived from it —
 * already shows; the value the caller sees must be the value acted on.
 *
 * An identical duplicate (body names the same key with the SAME value) is
 * accepted, not rejected: a client that repeats a value it already put in
 * the URL has made no error, and rejecting a harmless echo would only
 * invite spurious client-side special-casing to strip it before every call.
 */

/**
 * Resolves one value that may arrive via a path parameter, the request
 * body, or both.
 *
 * `pathValue` is `undefined` when the current route has no such path
 * segment at all (e.g. `store.create`'s `POST /api/v1/stores`) — in that
 * case the body is the sole source, unconditionally, which is exactly
 * `store.create`'s existing behavior and is left unchanged by this rule.
 */
export function resolvePathOrBodyValue(key: string, pathValue: string | undefined, body: unknown): unknown {
  const bodyRecord = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : undefined;
  const bodyValue = bodyRecord?.[key];

  if (pathValue === undefined) {
    return bodyValue;
  }
  if (bodyValue !== undefined && bodyValue !== pathValue) {
    throw new CapabilityError("VALIDATION_ERROR", `'${key}' in the request body does not match '${key}' in the URL.`, {
      field: key,
      pathValue,
      bodyValue,
    });
  }
  return pathValue;
}

/**
 * Builds the object a capability's Zod input schema should validate,
 * driven by `CapabilityDefinition.route.pathParams` rather than a
 * hand-written list per controller — so a future capability that mixes
 * path and body input cannot forget this check simply by not knowing it
 * exists. Every key in `route.pathParams` is resolved through
 * {@link resolvePathOrBodyValue}; every other body key passes through
 * unchanged.
 *
 * `route.pathParams: []` (`organization.create`, `store.create`) makes this
 * a no-op that returns the body verbatim — those two controllers are left
 * calling their schema's `.safeParse(body)` directly rather than being
 * routed through this function, since they have no path parameter to
 * reconcile and nothing here would change their behavior.
 */
export function buildValidationInput(
  route: CapabilityRoute,
  pathParams: Record<string, string | undefined>,
  body: unknown,
): Record<string, unknown> {
  const bodyRecord = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const result: Record<string, unknown> = { ...bodyRecord };

  for (const key of route.pathParams) {
    result[key] = resolvePathOrBodyValue(key, pathParams[key], body);
  }

  return result;
}
