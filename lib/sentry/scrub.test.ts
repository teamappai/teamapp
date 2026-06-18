import { describe, it, expect } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { redactPii, scrubEvent } from "./scrub";

describe("redactPii", () => {
  it("redacts email addresses", () => {
    expect(redactPii("contact jane.doe@example.com now")).toBe(
      "contact [redacted-email] now",
    );
  });

  it("redacts phone numbers in common formats", () => {
    expect(redactPii("call (415) 555-0132")).toContain("[redacted-phone]");
    expect(redactPii("call +1 415-555-0132")).toContain("[redacted-phone]");
    expect(redactPii("call 4155550132")).toContain("[redacted-phone]");
  });

  it("leaves non-PII text intact", () => {
    expect(redactPii("Deal stage moved to Pending")).toBe(
      "Deal stage moved to Pending",
    );
  });
});

describe("scrubEvent (Sentry beforeSend)", () => {
  it("drops the request body, cookies, query string, and auth headers", () => {
    const event = {
      request: {
        url: "https://app.example.com/app/deals",
        data: { clientName: "John Buyer", price: 500000 },
        cookies: { session: "abc" },
        query_string: "email=john@example.com",
        headers: {
          cookie: "session=abc",
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
      },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.query_string).toBeUndefined();
    expect(out.request?.headers?.cookie).toBeUndefined();
    expect(out.request?.headers?.authorization).toBeUndefined();
    // Non-sensitive headers survive.
    expect(out.request?.headers?.["content-type"]).toBe("application/json");
  });

  it("redacts PII in the message and exception values", () => {
    const event = {
      message: "Failed for user bob@example.com",
      exception: {
        values: [{ type: "Error", value: "Lookup failed for 415-555-0132" }],
      },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    expect(out.message).toBe("Failed for user [redacted-email]");
    expect(out.exception?.values?.[0]?.value).toContain("[redacted-phone]");
  });

  it("drops sensitive keys from extra/contexts (names, emails, license, messages)", () => {
    const event = {
      extra: {
        clientName: "Jane Seller",
        license_number: "DRE 01234567",
        message_content: "private thread text",
        dealId: "deal_123",
      },
      contexts: {
        profile: { email: "agent@example.com", role: "agent" },
      },
    } as unknown as ErrorEvent;

    const out = scrubEvent(event);
    const extra = out.extra as Record<string, unknown>;
    expect(extra.clientName).toBe("[redacted]");
    expect(extra.license_number).toBe("[redacted]");
    expect(extra.message_content).toBe("[redacted]");
    // Non-sensitive identifiers are preserved for debugging.
    expect(extra.dealId).toBe("deal_123");

    const profile = (out.contexts as Record<string, Record<string, unknown>>)
      .profile;
    expect(profile.email).toBe("[redacted]");
    expect(profile.role).toBe("agent");
  });
});
