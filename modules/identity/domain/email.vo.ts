/**
 * The one definition of how an email address is normalized for lookup.
 *
 * `users` carries both `email` (as the person typed it) and
 * `email_normalized`, which is what `users_email_normalized_key` enforces
 * uniqueness on. Anything that looks a user up by address must normalize the
 * same way the row was written, so the rule lives here in the module that
 * owns the table rather than being re-implemented at each call site.
 *
 * Case folding and trimming only. No local-part rewriting (dot-stripping,
 * plus-addressing): those differ per provider, and treating
 * `a+b@example.com` as `a@example.com` would silently merge two accounts.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
