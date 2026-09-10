/**
 * **Ruling ب-4's closed V1 quota resource list**, recorded in
 * `PHASE_2_BRIEF.md` §9.13 and quoted rather than restated:
 *
 * > **The V1 quota resource list contains only what the platform can count:
 * > `members`, `stores`, `domains`.** All three are countable from the
 * > platform's own tables.
 *
 * **It is a restriction, not an addition** — those three and nothing else in
 * V1. A resource joins the list only when the platform can count it from data
 * it holds, which is why **storage and bandwidth are excluded and are neither
 * enforced nor advertised**: ADR-060 is a port with no adapter, and nothing
 * meters the edge.
 *
 * `domains` is here because **ADR-027 item 9** puts it here: *"Domain count is a
 * quota; custom domains are an entitlement. Both are enforced through the
 * standard capability policy chain. Add `domains` to the quota resource list."*
 * **That sentence also makes `domains` the first resource on both axes at
 * once** — see `resolve-entitlement.ts` for how the two compose, and which one
 * dominates.
 *
 * The list is closed in **two** places — this union and the `CHECK` in
 * `20260910120000_entitlement__create_quota_policies.sql` — the discipline item
 * 5 used for `reason_code`. Adding a resource costs a migration and an edit
 * here, deliberately: a new quota resource is a new promise the platform must
 * be able to count.
 */
export const QUOTA_RESOURCES = ["members", "stores", "domains"] as const;

export type QuotaResource = (typeof QUOTA_RESOURCES)[number];

export function isQuotaResource(value: string): value is QuotaResource {
  return (QUOTA_RESOURCES as readonly string[]).includes(value);
}

/**
 * Which module can count each resource, recorded here because **item 8 inherits
 * it** and because the answer is not uniform.
 *
 * `PHASE_2_BRIEF.md` §5 permits this shape and forbids the other one: *"No
 * cross-module foreign keys; **cross-module reads go through contracts**"*. A
 * count is a read, so the module that owns a resource exposes a counter through
 * its `contracts/` barrel — exactly as item 4 placed its serving-state function
 * so a later module could call it without dragging a domain type across the
 * boundary, and as item 6 read the pinned plan version through
 * `modules/subscription`'s contract.
 *
 * **`members` and `stores` both live in `modules/tenant`** — verified against
 * the creating migrations, `20260822090300_tenant__create_memberships.sql` and
 * `20260822090400_tenant__create_stores.sql`.
 *
 * **`domains` has no table at all yet.** Domain verification is Phase 4
 * (ADR-027, ADR-028), so its counter cannot exist until then. **That is item 8's
 * problem to state, not to solve**: a quota on a resource with no table is
 * unenforceable, and it must say so rather than counting zero and reporting
 * success — the failure `AGENTS.md` §8's second rule exists to catch, in a
 * different shape.
 */
export const RESOURCE_OWNING_MODULE: Readonly<Record<QuotaResource, string | null>> = {
  members: "tenant",
  stores: "tenant",
  domains: null,
};
