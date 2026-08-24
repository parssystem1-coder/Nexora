// VIOLATION FIXTURE (ERROR-CODE-UNDOCUMENTED): declares an error code that
// 05_API_CAPABILITY_CONTRACTS.md §7 does not list, for detector testing only.
export const widgetReadCapability: CapabilityDefinition = {
  id: "widget.read",
  version: "1",
  requiredPermissions: [],
  risk: "READ",
  idempotent: false,
  audit: true,
  storeScoped: false,
  route: { method: "get", path: "/api/v1/widgets/{widgetId}", pathParams: ["widgetId"], successStatus: 200 },
  inputSchema: widgetReadInputSchema,
  outputSchema: widgetOutputSchema,
  errorCodes: ["AUTHENTICATION_REQUIRED", "WIDGET_EXPLODED"],
};
