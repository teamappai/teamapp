import type { ErrorEvent } from "@sentry/nextjs";

/**
 * PII scrubbing for Sentry (Phase 16B, Decision 1).
 *
 * TeamApp handles regulated real-estate data. We must NOT ship the following to
 * Sentry: request/response bodies, client names/emails/phones, agent license
 * numbers, or message contents. `sendDefaultPii` is left at its safe default
 * (false) in every runtime config, and this scrubber is the second line of
 * defense — it runs in `beforeSend` for client, server, and edge.
 *
 * Kept dependency-free (only a type-only Sentry import) so it is trivially
 * unit-testable.
 */

const REDACTED = "[redacted]";

// Match an email address anywhere in a free-text string.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// North-American style phone numbers (optional +1, separators, parens).
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

// Object keys whose VALUES are PII regardless of content. Anything matching is
// dropped wholesale from `extra`, `tags`, and `contexts`.
const SENSITIVE_KEY =
  /(name|email|e_mail|phone|mobile|license|licence|password|secret|token|api[_-]?key|ssn|address|client|contact|message|body|content)/i;

/** Redact emails and phone numbers from a free-text string. */
export function redactPii(text: string): string {
  return text
    .replace(EMAIL, "[redacted-email]")
    .replace(PHONE, "[redacted-phone]");
}

/** Recursively redact a value, dropping sensitive keys and scrubbing strings. */
function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return REDACTED; // guard against deep/cyclic structures
  if (typeof value === "string") return redactPii(value);
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : scrubValue(v, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * `beforeSend` hook: strip request bodies, cookies, and sensitive headers, then
 * redact PII from messages, exception values, breadcrumbs, and structured
 * context. Returns the mutated event (Sentry mutates in place by convention).
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  // ── request: never send the body, cookies, query string, or auth headers ──
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/cookie|authorization|x-api-key|token/i.test(h)) {
          delete event.request.headers[h];
        }
      }
    }
  }

  // ── free-text fields ──
  if (typeof event.message === "string") {
    event.message = redactPii(event.message);
  }
  for (const ex of event.exception?.values ?? []) {
    if (typeof ex.value === "string") ex.value = redactPii(ex.value);
  }
  for (const bc of event.breadcrumbs ?? []) {
    if (typeof bc.message === "string") bc.message = redactPii(bc.message);
    if (bc.data) bc.data = scrubValue(bc.data) as typeof bc.data;
  }

  // ── structured context (drop sensitive keys, scrub the rest) ──
  if (event.extra) event.extra = scrubValue(event.extra) as typeof event.extra;
  if (event.contexts) {
    event.contexts = scrubValue(event.contexts) as typeof event.contexts;
  }
  if (event.tags) event.tags = scrubValue(event.tags) as typeof event.tags;

  return event;
}
