import { hash, verify, Algorithm } from "@node-rs/argon2";
import type { PasswordHasher } from "../domain/password-hasher.js";

/**
 * ADR-029 item 2. `@node-rs/argon2` (napi-rs, prebuilt binaries per
 * platform via optionalDependencies — win32-x64-msvc included) rather than
 * the classic `argon2` package, which historically needs node-gyp and a C++
 * toolchain to build from source on a machine with no prebuilt binary for
 * its exact Node ABI. This repository's dev machine is Windows with no
 * Docker and no guaranteed build toolchain, so a package that might need to
 * compile is a real risk, not a theoretical one — confirmed by installing
 * and hashing/verifying with this exact package before committing to it
 * (see DECISION_LOG.md).
 *
 * Parameters (memoryCost 19456 KiB / 19 MiB, timeCost 2, parallelism 1) are
 * OWASP's current minimum recommended Argon2id profile — a defensible,
 * widely-cited floor, not one this ADR or any other document in the pack
 * fixes. Tuned for a moderate per-login latency budget (observed ~15-50ms on
 * this dev machine) rather than maximum resistance; revisit with real
 * capacity/hardware numbers before this handles meaningful login volume.
 */
const MEMORY_COST_KIB = 19_456;
const TIME_COST = 2;
const PARALLELISM = 1;

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, {
      algorithm: Algorithm.Argon2id,
      memoryCost: MEMORY_COST_KIB,
      timeCost: TIME_COST,
      parallelism: PARALLELISM,
    });
  }

  async verify(storedHash: string, plainPassword: string): Promise<boolean> {
    return verify(storedHash, plainPassword);
  }
}
