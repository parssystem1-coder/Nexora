import type { CapabilityDefinition } from "../../modules/capability/contracts/index.js";
import {
  storeReadCapability,
  organizationCreateCapability,
  membershipInviteCapability,
} from "../../modules/tenant/contracts/index.js";

/**
 * Every implemented capability, in a stable order.
 *
 * ADR-033: "Generation keys off the capability definition and its Zod
 * schemas, never the controller module - capabilities are reachable from
 * MCP, AI and automation as well as REST, and the generator must run in CI
 * with no database reachable." Importing each module's `contracts/` (never
 * its interfaces/ or infrastructure/) is what keeps that true: nothing here
 * pulls in a controller, a Nest module, or a connection pool.
 *
 * Adding a capability without adding it here is caught by
 * tools/openapi/openapi.spec.ts, which asserts the registry covers every
 * `*.capability.ts` file in the tree.
 */
export const CAPABILITIES: readonly CapabilityDefinition[] = [
  membershipInviteCapability,
  organizationCreateCapability,
  storeReadCapability,
];
