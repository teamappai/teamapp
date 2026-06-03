import type { DeviceType } from "./types";

/**
 * Best-effort device + browser classification from a User-Agent string, used to
 * tag auth events (SR-4 — diagnosing the mobile login bug). Deliberately coarse:
 * we only need desktop/mobile/tablet buckets and a rough browser family, not a
 * full UA-parsing dependency.
 *
 * Pass `navigator.userAgent` on the client; pass the request UA header on the
 * server (login error path runs in a server action).
 */
export function deviceTypeFromUA(ua: string | null | undefined): DeviceType {
  if (!ua) return "desktop";
  const s = ua.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/.test(s)) return "mobile";
  return "desktop";
}

export function browserFromUA(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (s.includes("edg/")) return "edge";
  if (s.includes("opr/") || s.includes("opera")) return "opera";
  if (s.includes("chrome") && !s.includes("chromium")) return "chrome";
  if (s.includes("firefox")) return "firefox";
  if (s.includes("safari") && !s.includes("chrome")) return "safari";
  return "other";
}
