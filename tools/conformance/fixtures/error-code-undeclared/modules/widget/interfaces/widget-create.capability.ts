// VIOLATION FIXTURE (ERROR-CODE-UNDECLARED): FORBIDDEN is thrown by a guard
// this capability's own controller imports (widget-access.guard.ts), but is
// missing from this declared list, for detector testing only.
export const widgetCreateCapability: CapabilityDefinition = {
  id: "widget.create",
  version: "1",
  requiredPermissions: ["widget.create"],
  risk: "MEDIUM_WRITE",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: { method: "post", path: "/api/v1/widgets", pathParams: [], successStatus: 201 },
  inputSchema: widgetCreateInputSchema,
  outputSchema: widgetOutputSchema,
  errorCodes: ["AUTHENTICATION_REQUIRED", "VALIDATION_ERROR"],
};
