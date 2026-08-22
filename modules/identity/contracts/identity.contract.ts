/** The public shape other modules see after a session has been authenticated. */
export interface AuthenticatedIdentity {
  userId: string;
  sessionId: string;
  activeOrganizationId: string | null;
}
