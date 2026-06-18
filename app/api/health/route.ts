import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * Health check (Phase 16B, Decision 2). Verifies Supabase DB connectivity with
 * a cheap query and returns:
 *   - 200 { status: "ok" }    when the database is reachable
 *   - 503 { status: "error" } when it is not
 *
 * No authentication — uptime monitors must be able to reach it. The response
 * body never includes internal details (table names, error messages, stack
 * traces): a probe only needs the status, and leaking internals would help an
 * attacker fingerprint the stack.
 */

// Always evaluate fresh; a cached health response would be useless to a monitor.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createServiceClient();
    // Cheapest possible "SELECT 1": a HEAD request against a always-present
    // table. We don't read any rows — only whether the round-trip succeeds.
    const { error } = await supabase
      .from("companies")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { status: "error" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { status: "ok" },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Network/config failure reaching the DB — report unhealthy, no detail.
    return NextResponse.json(
      { status: "error" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
