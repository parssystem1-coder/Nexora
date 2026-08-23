export class Credential {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    /** An Argon2id PHC-format string (algorithm, params and salt embedded) — never a raw password, never returned by any API. */
    public readonly passwordHash: string,
    public readonly createdAt: Date,
  ) {}
}
