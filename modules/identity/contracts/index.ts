export type { AuthenticatedIdentity } from "./identity.contract.js";
export { SessionGuard } from "../interfaces/session.guard.js";
export type { RequestWithIdentity } from "../interfaces/session.guard.js";
export {
  UserRepositoryPg,
  normalizeEmail,
  SessionRevocationRepositoryPg,
  SessionRepositoryPg,
} from "./identity.contract.js";
export type { User, UserRepository, SessionRevocationRepository, SessionRepository } from "./identity.contract.js";
export { CheckSessionRevokedService } from "./identity.contract.js";
export { authLoginCapability } from "../interfaces/auth-login.capability.js";
export { authLogoutCapability } from "../interfaces/auth-logout.capability.js";
export { authLogoutAllCapability } from "../interfaces/auth-logout-all.capability.js";
