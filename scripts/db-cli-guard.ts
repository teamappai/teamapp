/**
 * Guarded wrapper around the destructive Supabase CLI commands (`db reset`,
 * `db push`). Resolves the target the CLI would actually hit, runs it through
 * the same guard as the seed (db/seed/guard.ts), and only then shells out to
 * the real `supabase` binary, passing every extra arg through.
 *
 * Wired in package.json:
 *   "db:reset":   "tsx scripts/db-cli-guard.ts reset"
 *   "db:migrate": "tsx scripts/db-cli-guard.ts push"
 *
 * Target resolution (the CLI does NOT read NEXT_PUBLIC_SUPABASE_URL):
 *   - `--db-url <url>`           → that URL.
 *   - `--linked`, or `push`      → the linked remote, read from
 *                                  supabase/.temp/project-ref → https://<ref>.supabase.co
 *   - `reset` with neither       → the LOCAL shadow DB (127.0.0.1).
 * If the linked ref cannot be read, the target is left empty so the guard
 * refuses (default-deny) rather than guessing.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertSafeDestructiveTarget,
  printTargetBanner,
} from "../db/seed/guard";

type Sub = "reset" | "push";

const sub = process.argv[2] as Sub | undefined;
const passThrough = process.argv.slice(3);

if (sub !== "reset" && sub !== "push") {
  console.error(
    `db-cli-guard: expected "reset" or "push" as the first argument, got "${sub ?? ""}".`,
  );
  process.exit(1);
}

function flagValue(flag: string): string | null {
  const i = passThrough.indexOf(flag);
  if (i !== -1 && i + 1 < passThrough.length) return passThrough[i + 1];
  const inline = passThrough.find((a) => a.startsWith(`${flag}=`));
  return inline ? inline.slice(flag.length + 1) : null;
}

function readLinkedRef(): string | null {
  try {
    const ref = readFileSync(
      resolve(process.cwd(), "supabase/.temp/project-ref"),
      "utf8",
    ).trim();
    return ref || null;
  } catch {
    return null;
  }
}

/** Resolve the URL the CLI command will actually operate against. */
function resolveTargetUrl(): string {
  const dbUrl = flagValue("--db-url");
  if (dbUrl) return dbUrl;

  const targetsRemote = sub === "push" || passThrough.includes("--linked");
  if (targetsRemote) {
    const ref = readLinkedRef();
    // Empty string → guard classifies UNKNOWN and refuses (no guessing).
    return ref ? `https://${ref}.supabase.co` : "";
  }

  // `reset` with no remote flag operates on the local shadow database.
  return "http://127.0.0.1:54321";
}

const operation = `DB ${sub.toUpperCase()}`;
const targetUrl = resolveTargetUrl();

printTargetBanner(targetUrl, operation);
assertSafeDestructiveTarget(targetUrl, { operation });

// Guard passed (or the target is local) — run the real command.
const result = spawnSync("supabase", ["db", sub, ...passThrough], {
  stdio: "inherit",
});

if (result.error) {
  console.error(
    `db-cli-guard: failed to launch supabase — ${result.error.message}`,
  );
  process.exit(1);
}
process.exit(result.status ?? 1);
