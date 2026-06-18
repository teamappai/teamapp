import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * Stripe webhook signature hardening (Phase 16C).
 *
 * The webhook handler MUST reject any request whose body/signature pair does not
 * verify against STRIPE_WEBHOOK_SECRET — otherwise an attacker could POST a
 * forged `customer.subscription.deleted` and cancel a customer, or forge an
 * `invoice.paid` to flip a delinquent account back to active. These tests prove
 * `stripe.webhooks.constructEvent` is enforced before any event is processed.
 *
 * We exercise the REAL Stripe client (signature verification is the thing under
 * test) but mock every downstream side-effect module so the test is hermetic and
 * we can assert that NOTHING ran when a forged payload is rejected.
 */

// `lib/billing/*` and the service client are server-only — neutralize the guard.
vi.mock("server-only", () => ({}));

// Spy on the service client so we can assert it is never constructed (i.e. the
// event was rejected before any DB write / idempotency claim).
const createServiceClient = vi.fn(() => {
  throw new Error("createServiceClient must not be called for a forged event");
});
vi.mock("@/lib/supabase/service", () => ({ createServiceClient }));

// Downstream side-effect modules — mocked so importing the route is hermetic.
// None of these should run for a rejected signature; mocks make that provable.
const reconcileSubscription = vi.fn();
const companyIdForCustomer = vi.fn();
vi.mock("@/lib/billing/sync", () => ({
  reconcileSubscription,
  companyIdForCustomer,
}));
vi.mock("@/lib/email/billing", () => ({
  emailSubscriptionCreated: vi.fn(),
  emailPaymentFailed: vi.fn(),
  emailPaymentRecovered: vi.fn(),
  emailSubscriptionPaused: vi.fn(),
  emailCancellationCompleted: vi.fn(),
  emailTrialEnding: vi.fn(),
}));
vi.mock("@/lib/posthog/server", () => ({ captureServer: vi.fn() }));

import type { NextRequest } from "next/server";

const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";

// Minimal valid Stripe env so `stripeEnv()` passes and we reach constructEvent.
// The secret key is a dummy — constructEvent is pure crypto and makes no network
// call, so no real Stripe account is involved.
const STRIPE_ENV: Record<string, string> = {
  STRIPE_SECRET_KEY: "sk_test_dummy",
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PRICE_LAUNCH_MONTHLY: "price_dummy_lm",
  STRIPE_PRICE_LAUNCH_ANNUAL: "price_dummy_la",
  STRIPE_PRICE_LAUNCH_EXTRA_SEAT: "price_dummy_les",
  STRIPE_PRICE_PRO_MONTHLY: "price_dummy_pm",
  STRIPE_PRICE_PRO_ANNUAL: "price_dummy_pa",
  STRIPE_PRICE_PRO_EXTRA_SEAT: "price_dummy_pes",
};

beforeAll(() => {
  for (const [k, v] of Object.entries(STRIPE_ENV)) vi.stubEnv(k, v);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Silence the handler's expected error logging during the rejection path.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

/** Build a POST request with a raw body and optional stripe-signature header. */
function webhookRequest(body: string, signature?: string): NextRequest {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature !== undefined) headers.set("stripe-signature", signature);
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers,
    body,
  }) as unknown as NextRequest;
}

describe("POST /api/stripe/webhook signature verification", () => {
  it("rejects a forged signature with 400 and processes nothing", async () => {
    const { POST } = await import("./route");

    // A plausible-looking but invalid signature for a destructive event.
    const body = JSON.stringify({
      id: "evt_forged",
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_attacker" } },
    });
    const forged =
      "t=1700000000,v1=0000000000000000000000000000000000000000000000000000000000000000";

    const res = await POST(webhookRequest(body, forged));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Invalid signature",
    });
    // No event processed: the idempotency claim / DB writes never began.
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(reconcileSubscription).not.toHaveBeenCalled();
  });

  it("rejects a request with a tampered body under a stale signature", async () => {
    const { POST } = await import("./route");

    // Even a syntactically valid header can't authenticate an arbitrary body.
    const body = JSON.stringify({ id: "evt_x", type: "invoice.paid" });
    const res = await POST(
      webhookRequest(body, "t=1,v1=abc123def456abc123def456abc123def456abc1"),
    );

    expect(res.status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("rejects a request with no signature header (400, nothing processed)", async () => {
    const { POST } = await import("./route");

    const res = await POST(webhookRequest(JSON.stringify({ id: "evt_y" })));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Missing signature",
    });
    expect(createServiceClient).not.toHaveBeenCalled();
  });
});
