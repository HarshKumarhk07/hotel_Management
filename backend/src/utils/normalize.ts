/**
 * Normalization helpers used for guest-order → account matching. Linking only
 * ever compares *normalized* values for an exact match — never names, never
 * partial matches — so the same person is recognised regardless of formatting.
 */

/** Lowercased, trimmed email. Mirrors how the User schema stores emails. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Reduce a phone number to comparable digits. Strips spaces, dashes, brackets
 * and a leading `+`/country code, keeping the last 10 digits (the national
 * number) so "+91 98765 43210" and "098765 43210" match. Returns '' if there
 * aren't enough digits to be meaningful.
 */
export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return '';
  return digits.slice(-10);
}
