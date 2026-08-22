import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { StoreController } from "../../modules/tenant/interfaces/store.controller.js";
import { HttpExceptionFilter } from "../../modules/capability/interfaces/http-exception.filter.js";

/**
 * The one place every module's controllers get wired together
 * (DECISION_LOG.md "Task 1 directory structure..." — apps/api is bootstrap
 * only, no business logic).
 */
@Module({
  controllers: [StoreController],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule {}
