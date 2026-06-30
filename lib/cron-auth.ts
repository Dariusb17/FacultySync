import crypto from "crypto";

/**
 * Constant-time comparison of the x-cron-secret header against CRON_SECRET.
 * Length check first, then crypto.timingSafeEqual — verbatim from dental-saas.
 */
export function verifyCronSecret(headerValue: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !headerValue) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
