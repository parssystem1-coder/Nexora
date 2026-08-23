export type { AuthenticatedIdentity } from "./identity.contract.js";
export { SessionGuard } from "../interfaces/session.guard.js";
export type { RequestWithIdentity } from "../interfaces/session.guard.js";
export { UserRepositoryPg, normalizeEmail, SessionRevocationRepositoryPg } from "./identity.contract.js";
export type { User, UserRepository, SessionRevocationRepository } from "./identity.contract.js";
export { authLoginCapability } from "../interfaces/auth-login.capability.js";
