import "server-only";
import { createClient } from "@/lib/supabase/server";
import { inRange, type DateRange } from "@/lib/coaching/dates";

/**
 * Derived pipeline metrics pulled live from deals (read-only on the Activity Log
 * and folded into the coaching funnel). "Under Contract" is a snapshot of
 * current state; the loss/closed buckets are scoped to the active date range.
 *
 * Cancelled/Expired/Trash have no dedicated termination-date column, so we use
 * close_date when present, else the row's updated_at (the moment it last moved
 * stage) as the effective terminal date.
 */
export type PipelineSummary = {
  underContract: number;
  closedInPeriod: number;
  cancelledInPeriod: number;
  expiredInPeriod: number;
  trashInPeriod: number;
};

type StageShape = {
  name: string | null;
  is_terminal_won: boolean;
  is_terminal_lost: boolean;
} | null;

type DealShape = {
  close_date: string | null;
  updated_at: string;
  stage: StageShape;
};

const involvement = (uid: string) =>
  `created_by.eq.${uid},listing_agent_id.eq.${uid},co_listing_agent_id.eq.${uid},buyer_agent_id.eq.${uid}`;

export async function getPipelineSummary(args: {
  companyId: string | null;
  /** When set, scope to deals this user is involved in ("My pipeline"). */
  userId?: string | null;
  range: DateRange;
}): Promise<PipelineSummary> {
  const supabase = await createClient();
  let query = supabase
    .from("deals")
    .select(
      "close_date, updated_at, stage:deal_stages!stage_id (name, is_terminal_won, is_terminal_lost)",
    )
    .is("deleted_at", null)
    .eq("is_draft", false);

  if (args.companyId) query = query.eq("company_id", args.companyId);
  if (args.userId) query = query.or(involvement(args.userId));

  const { data } = await query;
  const deals = (data ?? []) as unknown as DealShape[];

  const summary: PipelineSummary = {
    underContract: 0,
    closedInPeriod: 0,
    cancelledInPeriod: 0,
    expiredInPeriod: 0,
    trashInPeriod: 0,
  };

  for (const d of deals) {
    const name = d.stage?.name ?? "";
    const termDate = d.close_date ?? d.updated_at.slice(0, 10);
    if (name === "Under Contract") summary.underContract += 1;
    if (d.stage?.is_terminal_won && inRange(d.close_date, args.range)) {
      summary.closedInPeriod += 1;
    }
    if (name === "Cancelled" && inRange(termDate, args.range)) {
      summary.cancelledInPeriod += 1;
    }
    if (name === "Expired" && inRange(termDate, args.range)) {
      summary.expiredInPeriod += 1;
    }
    if (name === "Trash" && inRange(termDate, args.range)) {
      summary.trashInPeriod += 1;
    }
  }
  return summary;
}
