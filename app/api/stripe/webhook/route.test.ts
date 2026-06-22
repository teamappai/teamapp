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
 * Stripe webhook tests.
 *
 * Part 1 — signature hardening (Phase 16C): the handler MUST reject any request
 * whose body/signature pair does not verify against STRIPE_WEBHOOK_SECRET. We
 * exercise the REAL Stripe verifier (it's the thing under test) and assert that
 * NOTHING ran for a forged payload.
 *
 * Part 2 — reconcile authority (fix/subscription-reconcile-authority): a Stripe
 * customer can accumulate several subscriptions (e.g. re-subscribe after a
 * cancel). A stale `customer.subscription.deleted/updated` for a NON-tracked sub
 * must not clobber the company's live pointer/status. These tests drive the REAL
 * `reconcileSubscription` through the route with the Supabase + Stripe clients
 * faked, asserting both the DB writes and the gated side-effects (emails).
 */

// `lib/billing/*` and the service client are server-only — neutralize the guard.
vi.mock("server-only", () => ({}));

// Hoisted fakes so the (hoisted) vi.mock factories can reference them.
const H = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require("stripe");
  const realStripe = new Stripe("sk_test_dummy");

  // In-memory record of DB writes + a per-test response config for reads.
  const db: {
    updates: { table: string; payload: Record<string, unknown> }[];
    inserts: { table: string; payload: Record<string, unknown> }[];
    config: Record<string, { data: unknown; error: null }>;
  } = { updates: [], inserts: [], config: {} };

  function makeBuilder(table: string) {
    const b = {
      _t: table,
      _s: "",
      select(cols: string) {
        b._s = cols;
        return b;
      },
      eq() {
        return b;
      },
      is() {
        return b;
      },
      order() {
        return b;
      },
      limit() {
        return b;
      },
      maybeSingle() {
        return Promise.resolve(
          db.config[`${b._t}:${b._s}`] ?? { data: null, error: null },
        );
      },
      insert(payload: Record<string, unknown>) {
        db.inserts.push({ table, payload });
        return Promise.resolve({ error: null });
      },
      update(payload: Record<string, unknown>) {
        db.updates.push({ table, payload });
        return b;
      },
      // Make update().eq() awaitable.
      then(
        resolve: (v: { error: null }) => unknown,
        reject?: (e: unknown) => unknown,
      ) {
        return Promise.resolve({ error: null }).then(resolve, reject);
      },
    };
    return b;
  }

  const createServiceClient = vi.fn(() => ({
    from: (t: string) => makeBuilder(t),
  }));

  return {
    realStripe,
    subRetrieve: vi.fn(),
    subList: vi.fn(),
    createServiceClient,
    db,
  };
});

// Stripe client: REAL webhook verifier (signature is under test) + faked
// subscription lookups used by the reconcile guards.
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({
    webhooks: H.realStripe.webhooks,
    subscriptions: { retrieve: H.subRetrieve, list: H.subList },
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: H.createServiceClient,
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
import { emailCancellationCompleted } from "@/lib/email/billing";
import { captureServer } from "@/lib/posthog/server";

const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";

// Minimal valid Stripe env so `stripeEnv()` passes and we reach constructEvent.
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
  H.db.updates = [];
  H.db.inserts = [];
  H.db.config = {};
  H.subRetrieve.mockReset();
  H.subList.mockReset();
  // Silence expected error logging on rejection paths.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
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

/** A genuinely-signed webhook request for an event object. */
let evtCounter = 0;
function signedEvent(type: string, object: unknown): NextRequest {
  const body = JSON.stringify({
    id: `evt_${++evtCounter}`,
    type,
    data: { object },
  });
  const signature = H.realStripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: WEBHOOK_SECRET,
  });
  return webhookRequest(body, signature);
}

/** Build a Stripe-subscription-shaped object for the event payload. */
function sub(opts: {
  id: string;
  status: string;
  customer?: string;
  company?: string;
}) {
  return {
    id: opts.id,
    status: opts.status,
    customer: opts.customer ?? "cus_1",
    cancel_at_period_end: false,
    pause_collection: null,
    trial_end: null,
    metadata: { company_id: opts.company ?? "comp_1" },
    items: { data: [] },
  };
}

describe("POST /api/stripe/webhook signature verification", () => {
  it("rejects a forged signature with 400 and processes nothing", async () => {
    const { POST } = await import("./route");

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
    expect(H.createServiceClient).not.toHaveBeenCalled();
  });

  it("rejects a request with a tampered body under a stale signature", async () => {
    const { POST } = await import("./route");

    const body = JSON.stringify({ id: "evt_x", type: "invoice.paid" });
    const res = await POST(
      webhookRequest(body, "t=1,v1=abc123def456abc123def456abc123def456abc1"),
    );

    expect(res.status).toBe(400);
    expect(H.createServiceClient).not.toHaveBeenCalled();
  });

  it("rejects a request with no signature header (400, nothing processed)", async () => {
    const { POST } = await import("./route");

    const res = await POST(webhookRequest(JSON.stringify({ id: "evt_y" })));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "Missing signature",
    });
    expect(H.createServiceClient).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/webhook reconcile authority", () => {
  it("ignores a deleted event for a non-authoritative canceled sub (no clobber, no email)", async () => {
    const { POST } = await import("./route");
    // Company tracks the live sub; a stale event arrives for an old canceled one.
    H.db.config["companies:stripe_subscription_id"] = {
      data: { stripe_subscription_id: "sub_active" },
      error: null,
    };

    const res = await POST(
      signedEvent(
        "customer.subscription.deleted",
        sub({ id: "sub_old", status: "canceled" }),
      ),
    );

    expect(res.status).toBe(200);
    // GUARD A: no write to companies, no Stripe lookups, no cancellation email.
    expect(H.db.updates.filter((u) => u.table === "companies")).toHaveLength(0);
    expect(H.subRetrieve).not.toHaveBeenCalled();
    expect(H.subList).not.toHaveBeenCalled();
    expect(emailCancellationCompleted).not.toHaveBeenCalled();
    expect(captureServer).not.toHaveBeenCalled();
  });

  it("ignores an updated event for a non-authoritative canceled sub (no clobber)", async () => {
    const { POST } = await import("./route");
    H.db.config["companies:stripe_subscription_id"] = {
      data: { stripe_subscription_id: "sub_active" },
      error: null,
    };

    const res = await POST(
      signedEvent(
        "customer.subscription.updated",
        sub({ id: "sub_old", status: "canceled" }),
      ),
    );

    expect(res.status).toBe(200);
    expect(H.db.updates.filter((u) => u.table === "companies")).toHaveLength(0);
  });

  it("cancels when the authoritative sub is deleted and no other active sub exists (email fires)", async () => {
    const { POST } = await import("./route");
    H.db.config["companies:stripe_subscription_id"] = {
      data: { stripe_subscription_id: "sub_active" },
      error: null,
    };
    H.db.config["users:email"] = {
      data: { email: "lead@example.com" },
      error: null,
    };
    // GUARD C lookup: only the now-canceled sub exists for the customer.
    H.subList.mockResolvedValue({
      data: [{ id: "sub_active", status: "canceled" }],
    });

    const res = await POST(
      signedEvent(
        "customer.subscription.deleted",
        sub({ id: "sub_active", status: "canceled" }),
      ),
    );

    expect(res.status).toBe(200);
    const update = H.db.updates.find((u) => u.table === "companies");
    expect(update?.payload.status).toBe("canceled");
    expect(update?.payload.stripe_subscription_id).toBe("sub_active");
    expect(emailCancellationCompleted).toHaveBeenCalledWith({
      to: "lead@example.com",
    });
    expect(captureServer).toHaveBeenCalledWith(
      "unsubscribe_completed",
      expect.objectContaining({ company_id: "comp_1" }),
      "comp_1",
      { company: "comp_1" },
    );
  });

  it("self-heals to an active sub when the authoritative sub is deleted but another is active (stays active, no cancel email)", async () => {
    const { POST } = await import("./route");
    // Company still tracks the OLD sub that is now being deleted.
    H.db.config["companies:stripe_subscription_id"] = {
      data: { stripe_subscription_id: "sub_old" },
      error: null,
    };
    // GUARD C lookup finds a live replacement on the same customer.
    H.subList.mockResolvedValue({
      data: [
        { id: "sub_old", status: "canceled" },
        sub({ id: "sub_new", status: "active" }),
      ],
    });
    // GUARD B re-check: the stored (old) sub is confirmed dead → adopt the new.
    H.subRetrieve.mockResolvedValue({ status: "canceled" });

    const res = await POST(
      signedEvent(
        "customer.subscription.deleted",
        sub({ id: "sub_old", status: "canceled" }),
      ),
    );

    expect(res.status).toBe(200);
    const update = H.db.updates.find((u) => u.table === "companies");
    expect(update?.payload.stripe_subscription_id).toBe("sub_new");
    expect(update?.payload.status).toBe("active");
    // Not a real cancellation → no cancellation side-effects.
    expect(emailCancellationCompleted).not.toHaveBeenCalled();
    expect(captureServer).not.toHaveBeenCalled();
  });
});
