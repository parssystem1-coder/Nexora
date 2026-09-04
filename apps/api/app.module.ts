import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { StoreController } from "../../modules/tenant/interfaces/store.controller.js";
import { OrganizationController } from "../../modules/tenant/interfaces/organization.controller.js";
import { MembershipController } from "../../modules/tenant/interfaces/membership.controller.js";
import { MembershipRoleController } from "../../modules/tenant/interfaces/membership-role.controller.js";
import { MembershipRevokeController } from "../../modules/tenant/interfaces/membership-revoke.controller.js";
import { StoreCreateController } from "../../modules/tenant/interfaces/store-create.controller.js";
import { OrganizationSwitchController } from "../../modules/tenant/interfaces/organization-switch.controller.js";
import { PlanController } from "../../modules/billing/interfaces/plan.controller.js";
import { AuthLoginController } from "../../modules/identity/interfaces/auth-login.controller.js";
import { AuthLogoutController } from "../../modules/identity/interfaces/auth-logout.controller.js";
import { AuthLogoutAllController } from "../../modules/identity/interfaces/auth-logout-all.controller.js";
import { StoreAccessGuard } from "../../modules/tenant/interfaces/store-access.guard.js";
import { OrganizationAccessGuard } from "../../modules/tenant/interfaces/organization-access.guard.js";
import { SessionGuard } from "../../modules/identity/interfaces/session.guard.js";
import { HttpExceptionFilter } from "../../modules/capability/interfaces/http-exception.filter.js";
import { APP_DB, AUDIT_DB, createAppDb, createAuditDb } from "../../platform/db/connections.js";
import { RATE_LIMIT_STORE } from "../../platform/rate-limit/store.js";
import { InProcessRateLimitStore } from "../../platform/rate-limit/in-process-store.js";
import { systemClock } from "../../platform/clock.js";
import { DatabaseLifecycle } from "./database-lifecycle.provider.js";
import { HealthController } from "./health.controller.js";

/**
 * The one place every module's controllers and guards get wired together
 * (DECISION_LOG.md "Task 1 directory structure..." — apps/api is bootstrap
 * only, no business logic), and the one place the app's database
 * connections are created (db-providers.ts).
 */
@Module({
  controllers: [
    HealthController,
    StoreController,
    OrganizationController,
    MembershipController,
    MembershipRoleController,
    MembershipRevokeController,
    StoreCreateController,
    OrganizationSwitchController,
    PlanController,
    AuthLoginController,
    AuthLogoutController,
    AuthLogoutAllController,
  ],
  providers: [
    { provide: APP_DB, useFactory: createAppDb },
    { provide: AUDIT_DB, useFactory: createAuditDb },
    // One instance per running app (per createApp()/createTestApp() call) -
    // in-process, per RISK_REGISTER.md R-005 (see platform/rate-limit/
    // in-process-store.ts's own doc comment for what that does and does not
    // guarantee). Not a bare module-level singleton: DI-scoping it this way
    // is what keeps each test file's own app instance isolated from every
    // other's rate-limit state.
    { provide: RATE_LIMIT_STORE, useFactory: () => new InProcessRateLimitStore(systemClock) },
    DatabaseLifecycle,
    SessionGuard,
    StoreAccessGuard,
    OrganizationAccessGuard,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
