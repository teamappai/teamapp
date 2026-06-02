import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

// Pure helpers live in seat-utils (client-safe); re-export for server callers.
export {
  seatBand,
  nextPlanUp,
  perSeatMonthlyCents,
  type SeatBand,
} from "@/lib/billing/seat-utils";

/**
 * Seat accounting for billing + invite enforcement (Phase 12, Decision 4).
 *
 * "Used" seats = active user rows (not soft-deleted, not archived) PLUS open
 * invitations (not yet accepted, not expired). Pending invites count so a team
 * can't oversubscribe by blasting invites up to 2× their cap.
 */
export type SeatUsage = {
  activeUsers: number;
  pendingInvites: number;
  used: number;
  total: number;
  /** Whole-number utilization percent (0–100+, never NaN). */
  pct: number;
  available: number;
};

/** Compute current seat usage for a company. */
export async function getSeatUsage(
  companyId: string,
  seatsTotal: number,
): Promise<SeatUsage> {
  const service = createServiceClient();
  const nowIso = new Date().toISOString();

  const [usersRes, invitesRes] = await Promise.all([
    service
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .neq("status", "archived"),
    service
      .from("user_invitations")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("accepted_at", null)
      .gt("expires_at", nowIso),
  ]);

  const activeUsers = usersRes.count ?? 0;
  const pendingInvites = invitesRes.count ?? 0;
  const used = activeUsers + pendingInvites;
  const total = Math.max(0, seatsTotal);
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;

  return {
    activeUsers,
    pendingInvites,
    used,
    total,
    pct,
    available: Math.max(0, total - used),
  };
}
