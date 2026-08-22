export interface PermissionCheckRepository {
  hasPermission(tenantId: string, membershipId: string, permissionKey: string): Promise<boolean>;
}
