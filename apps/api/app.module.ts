import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { StoreController } from "../../modules/tenant/interfaces/store.controller.js";
import { OrganizationController } from "../../modules/tenant/interfaces/organization.controller.js";
import { MembershipController } from "../../modules/tenant/interfaces/membership.controller.js";
import { StoreAccessGuard } from "../../modules/tenant/interfaces/store-access.guard.js";
import { OrganizationAccessGuard } from "../../modules/tenant/interfaces/organization-access.guard.js";
import { SessionGuard } from "../../modules/identity/interfaces/session.guard.js";
import { HttpExceptionFilter } from "../../modules/capability/interfaces/http-exception.filter.js";
import { APP_DB, AUDIT_DB, createAppDb, createAuditDb } from "../../platform/db/connections.js";
import { DatabaseLifecycle } from "./database-lifecycle.provider.js";

/**
 * The one place every module's controllers and guards get wired together
 * (DECISION_LOG.md "Task 1 directory structure..." — apps/api is bootstrap
 * only, no business logic), and the one place the app's database
 * connections are created (db-providers.ts).
 */
@Module({
  controllers: [StoreController, OrganizationController, MembershipController],
  providers: [
    { provide: APP_DB, useFactory: createAppDb },
    { provide: AUDIT_DB, useFactory: createAuditDb },
    DatabaseLifecycle,
    SessionGuard,
    StoreAccessGuard,
    OrganizationAccessGuard,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
