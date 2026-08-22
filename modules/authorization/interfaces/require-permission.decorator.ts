import { SetMetadata } from "@nestjs/common";

export const PERMISSION_KEY = "requiredPermission";

/** Route-level metadata read by PermissionGuard. */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
