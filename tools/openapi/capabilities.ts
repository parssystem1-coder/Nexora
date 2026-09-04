import type { CapabilityDefinition } from "../../modules/capability/contracts/index.js";
import {
  storeReadCapability,
  organizationCreateCapability,
  membershipInviteCapability,
  membershipRoleAssignCapability,
  storeCreateCapability,
  organizationSwitchCapability,
  membershipRevokeCapability,
} from "../../modules/tenant/contracts/index.js";
import { planListCapability } from "../../modules/billing/contracts/index.js";
import {
  authLoginCapability,
  authLogoutCapability,
  authLogoutAllCapability,
} from "../../modules/identity/contracts/index.js";

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
 * `auth.login` is the first capability sourced from a module other than
 * `modules/tenant` — importing straight from `modules/identity/contracts`
 * needed no change to this file's shape, only a second import.
 *
 * Adding a capability without adding it here is caught by
 * tools/openapi/openapi.spec.ts, which asserts the registry covers every
 * `*.capability.ts` file in the tree.
 */
export const CAPABILITIES: readonly CapabilityDefinition[] = [
  authLoginCapability,
  authLogoutCapability,
  authLogoutAllCapability,
  membershipInviteCapability,
  membershipRevokeCapability,
  membershipRoleAssignCapability,
  organizationCreateCapability,
  organizationSwitchCapability,
  planListCapability,
  storeCreateCapability,
  storeReadCapability,
];
