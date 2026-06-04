import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hybrid feature-flag resolver tests (Phase 15 §I2). The resolver checks the
 * DB first, then PostHog, with a 60s in-process cache. We mock both the service
 * client and posthog-node so the tests are hermetic.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────
// `lib/flags` is a server-only module; neutralize the import guard under vitest.
vi.mock("server-only", () => ({}));

const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const createServiceClient = vi.fn(() => ({ from }));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => createServiceClient(),
}));

const getFeatureFlag = vi.fn();
const shutdown = vi.fn().mockResolvedValue(undefined);
vi.mock("posthog-node", () => ({
  // Must be constructable (`new PostHog(...)`), so a class — not an arrow fn.
  PostHog: class {
    getFeatureFlag = getFeatureFlag;
    shutdown = shutdown;
  },
}));

// Server env present so the PostHog branch is reachable.
let serverEnv: unknown = {
  NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
  NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
  POSTHOG_PERSONAL_API_KEY: "phx_test",
};
vi.mock("@/lib/env", () => ({
  posthogServerEnv: () => serverEnv,
}));

import { getFlag, isFlagEnabled, __clearFlagCache } from "@/lib/flags";

const CTX = { userId: "user-1", companyId: "company-1" };

beforeEach(() => {
  __clearFlagCache();
  vi.clearAllMocks();
  serverEnv = {
    NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
    POSTHOG_PERSONAL_API_KEY: "phx_test",
  };
});

describe("getFlag — DB resolution", () => {
  it("returns true when enabled_globally and skips PostHog", async () => {
    maybeSingle.mockResolvedValue({
      data: { enabled: null, enabled_globally: true, enabled_company_ids: [] },
      error: null,
    });
    const result = await getFlag("flag_x", CTX);
    expect(result).toBe(true);
    expect(getFeatureFlag).not.toHaveBeenCalled();
  });

  it("returns true when company is in enabled_company_ids", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        enabled: null,
        enabled_globally: false,
        enabled_company_ids: ["company-1"],
      },
      error: null,
    });
    const result = await getFlag("flag_x", CTX);
    expect(result).toBe(true);
    expect(getFeatureFlag).not.toHaveBeenCalled();
  });

  it("returns false when explicitly disabled (kill switch) and skips PostHog", async () => {
    maybeSingle.mockResolvedValue({
      data: { enabled: false, enabled_globally: true, enabled_company_ids: [] },
      error: null,
    });
    const result = await getFlag("flag_x", CTX);
    expect(result).toBe(false);
    expect(getFeatureFlag).not.toHaveBeenCalled();
  });

  it("falls through to PostHog when the DB defers (no row)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    getFeatureFlag.mockResolvedValue(true);
    const result = await getFlag("flag_x", CTX);
    expect(result).toBe(true);
    expect(getFeatureFlag).toHaveBeenCalledTimes(1);
  });

  it("falls through to PostHog when the row has no opinion", async () => {
    maybeSingle.mockResolvedValue({
      data: { enabled: null, enabled_globally: false, enabled_company_ids: [] },
      error: null,
    });
    getFeatureFlag.mockResolvedValue("variant-b");
    const result = await getFlag("flag_x", CTX);
    expect(result).toBe("variant-b");
    expect(getFeatureFlag).toHaveBeenCalledTimes(1);
  });
});

describe("getFlag — PostHog fallback + defaults", () => {
  it("returns false (default) when PostHog is unconfigured", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    serverEnv = null;
    const result = await getFlag("flag_x", CTX);
    expect(result).toBe(false);
    expect(getFeatureFlag).not.toHaveBeenCalled();
  });

  it("returns false when PostHog throws (unreachable)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    getFeatureFlag.mockRejectedValue(new Error("network"));
    const result = await getFlag("flag_x", CTX);
    expect(result).toBe(false);
  });
});

describe("getFlag — caching", () => {
  it("does not re-query within the TTL (cache hit)", async () => {
    maybeSingle.mockResolvedValue({
      data: { enabled: null, enabled_globally: true, enabled_company_ids: [] },
      error: null,
    });
    await getFlag("flag_cached", CTX);
    await getFlag("flag_cached", CTX);
    await getFlag("flag_cached", CTX);
    // maybeSingle is the DB terminal — should run exactly once for 3 reads.
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});

describe("isFlagEnabled", () => {
  it("coerces a string variant to true", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    getFeatureFlag.mockResolvedValue("variant-a");
    expect(await isFlagEnabled("flag_x", CTX)).toBe(true);
  });

  it("returns false for a falsy result", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    getFeatureFlag.mockResolvedValue(false);
    expect(await isFlagEnabled("flag_x", CTX)).toBe(false);
  });
});
