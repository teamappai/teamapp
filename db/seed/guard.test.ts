import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertSafeDestructiveTarget,
  classifyTarget,
  evaluateTarget,
  OPT_IN_ENV,
  OPT_IN_VALUE,
  parseProjectRef,
  PROD_REF,
  STAGING_REF,
} from "./guard";

const PROD_URL = `https://${PROD_REF}.supabase.co`;
const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
const UNKNOWN_URL = "https://abcdefghijklmnopqrst.supabase.co"; // valid-shaped, unrecognized ref
const OPT_IN = { [OPT_IN_ENV]: OPT_IN_VALUE };

describe("parseProjectRef", () => {
  it("extracts the ref from a standard Supabase URL", () => {
    expect(parseProjectRef(PROD_URL)).toBe(PROD_REF);
    expect(parseProjectRef(STAGING_URL)).toBe(STAGING_REF);
  });
  it("returns null for non-supabase / placeholder / empty hosts", () => {
    expect(parseProjectRef("https://YOUR_PROJECT_ID.supabase.co")).toBeNull();
    expect(parseProjectRef("http://127.0.0.1:54321")).toBeNull();
    expect(parseProjectRef("")).toBeNull();
    expect(parseProjectRef(null)).toBeNull();
    expect(parseProjectRef("not a url")).toBeNull();
  });
});

describe("classifyTarget", () => {
  it("classifies prod, staging, local, unknown", () => {
    expect(classifyTarget(PROD_URL)).toBe("PROD");
    expect(classifyTarget(STAGING_URL)).toBe("STAGING");
    expect(classifyTarget("http://localhost:54321")).toBe("LOCAL");
    expect(classifyTarget("http://127.0.0.1:54321")).toBe("LOCAL");
    expect(classifyTarget(UNKNOWN_URL)).toBe("UNKNOWN");
  });
  it("catches the prod ref as a raw substring of any URL", () => {
    expect(
      classifyTarget(
        `postgresql://postgres@db.${PROD_REF}.supabase.co:5432/postgres`,
      ),
    ).toBe("PROD");
    expect(
      classifyTarget(`https://aws-0-${PROD_REF}.pooler.supabase.com`),
    ).toBe("PROD");
  });
});

describe("evaluateTarget — production is refused unconditionally", () => {
  it("refuses the prod ref even when the opt-in var is set", () => {
    const d = evaluateTarget(PROD_URL, OPT_IN);
    expect(d.allowed).toBe(false);
    expect(d.classification).toBe("PROD");
  });
  it("refuses a prod-substring URL even with opt-in set", () => {
    const d = evaluateTarget(
      `postgresql://postgres@db.${PROD_REF}.supabase.co:5432/postgres`,
      OPT_IN,
    );
    expect(d.allowed).toBe(false);
    expect(d.classification).toBe("PROD");
  });
});

describe("evaluateTarget — staging requires the opt-in", () => {
  it("refuses staging without the opt-in var", () => {
    const d = evaluateTarget(STAGING_URL, {});
    expect(d.allowed).toBe(false);
    expect(d.classification).toBe("STAGING");
  });
  it("allows staging with the exact opt-in value", () => {
    const d = evaluateTarget(STAGING_URL, OPT_IN);
    expect(d.allowed).toBe(true);
    expect(d.classification).toBe("STAGING");
  });
  it("refuses staging with a wrong opt-in value", () => {
    const d = evaluateTarget(STAGING_URL, { [OPT_IN_ENV]: "yes" });
    expect(d.allowed).toBe(false);
  });
});

describe("evaluateTarget — local always allowed", () => {
  it("allows localhost and 127.0.0.1 without any opt-in", () => {
    expect(evaluateTarget("http://localhost:54321", {}).allowed).toBe(true);
    expect(evaluateTarget("http://127.0.0.1:54321", {}).allowed).toBe(true);
  });
});

describe("evaluateTarget — unknown / empty / unparseable refused (default-deny)", () => {
  it("refuses an unrecognized but valid-shaped ref, even with opt-in", () => {
    expect(evaluateTarget(UNKNOWN_URL, {}).allowed).toBe(false);
    expect(evaluateTarget(UNKNOWN_URL, OPT_IN).allowed).toBe(false);
    expect(evaluateTarget(UNKNOWN_URL, {}).classification).toBe("UNKNOWN");
  });
  it("refuses empty / null / undefined targets", () => {
    expect(evaluateTarget("", {}).allowed).toBe(false);
    expect(evaluateTarget(null, {}).allowed).toBe(false);
    expect(evaluateTarget(undefined, {}).allowed).toBe(false);
  });
  it("refuses unparseable targets", () => {
    expect(evaluateTarget("not a url", {}).allowed).toBe(false);
    expect(evaluateTarget("https://", {}).allowed).toBe(false);
  });
});

describe("assertSafeDestructiveTarget — process.exit wiring", () => {
  afterEach(() => vi.restoreAllMocks());

  it("exits(1) on a refused target", () => {
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    assertSafeDestructiveTarget(PROD_URL, { operation: "TEST" });
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("does not exit on an allowed (local) target", () => {
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const decision = assertSafeDestructiveTarget("http://127.0.0.1:54321", {
      operation: "TEST",
    });
    expect(exit).not.toHaveBeenCalled();
    expect(decision.allowed).toBe(true);
  });
});
