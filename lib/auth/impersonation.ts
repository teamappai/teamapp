import "server-only";
import crypto from "node:crypto";

/**
 * Impersonation cookie helpers (audit CR-4 / F-012).
 *
 * When a super_admin impersonates a user we replace the active Supabase session
 * with the target user's JWT, so the impersonated user's RLS context fully
 * applies. To get back, we stash the original admin's identity (for the audit
 * trail + banner) and their original session tokens (to restore cleanly,
 * preserving the admin's 2FA assurance level) in signed, HTTP-only cookies.
 *
 * Cookies are signed with an HMAC keyed on the service-role key (a server-only
 * secret) so an impersonated user cannot forge "I am admin X" and end the
 * session as someone else.
 */

/** Admin user id — drives the banner + the audit actor on end. */
export const IMPERSONATION_ADMIN_ID_COOKIE = "impersonation_admin_id";
/** Admin's original session tokens — used to restore the exact session. */
export const IMPERSONATION_SESSION_COOKIE = "impersonation_admin_session";

/** Short-lived: an impersonation session should not outlive a work session. */
export const IMPERSONATION_MAX_AGE_SECONDS = 60 * 60 * 2; // 2 hours

function secret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return key;
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(value)
    .digest("base64url");
}

/** Wrap a value as `"<payload>.<hmac>"` (payload base64url-encoded). */
export function signValue(value: string): string {
  const payload = Buffer.from(value, "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Verify + decode a signed value; returns null if tampered or malformed. */
export function verifyValue(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = signed.slice(0, dot);
  const mac = signed.slice(dot + 1);
  const expected = sign(payload);
  // Constant-time compare; lengths must match first.
  if (
    mac.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export type AdminSessionTokens = {
  access_token: string;
  refresh_token: string;
};

export function encodeSessionTokens(tokens: AdminSessionTokens): string {
  return signValue(JSON.stringify(tokens));
}

export function decodeSessionTokens(
  signed: string | undefined | null,
): AdminSessionTokens | null {
  const raw = verifyValue(signed);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AdminSessionTokens>;
    if (
      typeof parsed.access_token === "string" &&
      typeof parsed.refresh_token === "string"
    ) {
      return {
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
      };
    }
    return null;
  } catch {
    return null;
  }
}
