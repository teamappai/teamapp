/**
 * Destructive-target guard.
 *
 * Every script that can DELETE or overwrite real data (the seed, db reset/push,
 * the storage RLS probe) MUST run through this guard BEFORE it creates a client
 * or shells out to the Supabase CLI. It exists because `pnpm db:seed` was once
 * pointed at the PRODUCTION project — the seed clears the demo company's data
 * before reinserting, so it wiped live deals and resurrected deleted agents.
 *
 * Policy (in priority order):
 *   1. PRODUCTION  → REFUSED, unconditionally. The prod ref is matched as a raw
 *      substring of the URL *or* as the resolved project ref, and this branch is
 *      reachable by NO env var or flag. Opt-in cannot override production.
 *   2. LOCAL       (127.0.0.1 / localhost) → allowed. Throwaway local DB.
 *   3. STAGING     → allowed ONLY if TEAMAPP_ALLOW_REMOTE_DESTRUCTIVE=i-understand.
 *   4. UNKNOWN / empty / unparseable → REFUSED (default-deny). We never proceed
 *      against a target we cannot positively identify.
 *
 * No imports beyond the Node stdlib, so any script (TS run under tsx) can use it.
 */

/** The PRODUCTION project ref. Matching this — by ref or raw substring — is an
 *  unconditional refusal. Do not add an override path to this constant. */
export const PROD_REF = "fjgnihkvqplfncmdgtpq";

/** The STAGING project ref. Destructive ops here require the opt-in env var. */
export const STAGING_REF = "iwfmvsaxcohxjzndmhby";

/** The deliberate opt-in. Set NOWHERE by default, so the default is always
 *  refuse for any remote (staging) target. Must equal OPT_IN_VALUE exactly. */
export const OPT_IN_ENV = "TEAMAPP_ALLOW_REMOTE_DESTRUCTIVE";
export const OPT_IN_VALUE = "i-understand";

export type Classification = "PROD" | "STAGING" | "LOCAL" | "UNKNOWN";

/** Supabase project refs are 20-char lowercase alphanumeric. */
const REF_RE = /^[a-z0-9]{20}$/;

/**
 * Extract the project ref from a Supabase URL (`https://<ref>.supabase.co`).
 * Returns null when the host is not a `*.supabase.co` project or the label is
 * not a valid ref (e.g. the `YOUR_PROJECT_ID` placeholder, localhost, garbage).
 */
export function parseProjectRef(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    // Tolerate a bare host with no scheme (e.g. "abc.supabase.co").
    host = url
      .replace(/^[a-z]+:\/\//i, "")
      .split("/")[0]
      .split(":")[0];
  }
  if (!host || !host.endsWith(".supabase.co")) return null;
  const label = host.split(".")[0];
  return REF_RE.test(label) ? label : null;
}

function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(host);
  } catch {
    return (
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("0.0.0.0")
    );
  }
}

/**
 * Classify a target URL. The PRODUCTION backstop is evaluated FIRST and via a
 * raw substring match, so even a non-standard URL (pooler host, connection
 * string) that embeds the prod ref is caught.
 */
export function classifyTarget(url: string | null | undefined): Classification {
  // 1. PRODUCTION backstop — raw substring, before anything else.
  if (typeof url === "string" && url.includes(PROD_REF)) return "PROD";
  if (!url || !String(url).trim()) return "UNKNOWN";

  const ref = parseProjectRef(url);
  if (ref === PROD_REF) return "PROD"; // redundant with the substring check; kept deliberate.
  if (isLocal(url)) return "LOCAL";
  if (ref === STAGING_REF) return "STAGING";
  return "UNKNOWN"; // some other real project, or an unparseable target → default-deny.
}

export interface TargetDecision {
  allowed: boolean;
  classification: Classification;
  reason: string;
}

/**
 * Pure decision: does this destructive op get to run against `url`? `env` is
 * injectable so the logic is unit-testable without touching process.env.
 */
export function evaluateTarget(
  url: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): TargetDecision {
  const classification = classifyTarget(url);

  switch (classification) {
    case "PROD":
      return {
        allowed: false,
        classification,
        reason:
          `target is the PRODUCTION project (${PROD_REF}). Destructive ` +
          `operations against production are refused unconditionally — there ` +
          `is no override.`,
      };
    case "LOCAL":
      return {
        allowed: true,
        classification,
        reason: "local target (127.0.0.1 / localhost).",
      };
    case "STAGING":
      if (env[OPT_IN_ENV] === OPT_IN_VALUE) {
        return {
          allowed: true,
          classification,
          reason: `staging target with ${OPT_IN_ENV}=${OPT_IN_VALUE} set.`,
        };
      }
      return {
        allowed: false,
        classification,
        reason:
          `target is STAGING (${STAGING_REF}). To run a destructive op here, ` +
          `set ${OPT_IN_ENV}=${OPT_IN_VALUE} for this command only — e.g. ` +
          `${OPT_IN_ENV}=${OPT_IN_VALUE} pnpm db:seed`,
      };
    default:
      return {
        allowed: false,
        classification,
        reason:
          "target could not be identified as local or staging (empty, " +
          "unparseable, or an unrecognized project ref). Refusing by default.",
      };
  }
}

/**
 * Print a neutral, informative banner identifying the target. Always call this
 * BEFORE assertSafeDestructiveTarget so the user sees what is being targeted
 * regardless of the guard's decision.
 */
export function printTargetBanner(
  url: string | null | undefined,
  operation: string,
): void {
  const classification = classifyTarget(url);
  const ref = parseProjectRef(url) ?? "(unresolved)";
  const line = "━".repeat(62);
  console.log(`\n${line}`);
  console.log(`  DESTRUCTIVE DB OPERATION : ${operation}`);
  console.log(`  Target URL               : ${url || "(empty)"}`);
  console.log(`  Resolved project ref     : ${ref}`);
  console.log(`  Classification           : ${classification}`);
  console.log(`${line}\n`);
}

/**
 * Enforce the policy. Allowed → logs a one-line confirmation and returns the
 * decision. Refused → prints a loud banner and calls process.exit(1); it does
 * not return. Call printTargetBanner first.
 */
export function assertSafeDestructiveTarget(
  url: string | null | undefined,
  { operation }: { operation?: string } = {},
): TargetDecision {
  const op = operation ?? "DESTRUCTIVE DB OPERATION";
  const decision = evaluateTarget(url);

  if (decision.allowed) {
    console.log(
      `✓ ${op} target check passed — ${decision.classification}: ${decision.reason}\n`,
    );
    return decision;
  }

  const line = "█".repeat(62);
  console.error(`\n${line}`);
  console.error(`  ⛔ ${op} REFUSED`);
  console.error(`  Classification : ${decision.classification}`);
  console.error(`  Target URL     : ${url || "(empty)"}`);
  console.error(`  Reason         : ${decision.reason}`);
  console.error(`${line}\n`);
  process.exit(1);
}
