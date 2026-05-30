"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/profile";
import { canCreateDeals, canDeleteDeals } from "@/lib/deals/access";
import { logAudit } from "@/lib/audit/log";
import {
  dealSubmitSchema,
  dealPatchSchema,
  dealCommentSchema,
  type DealPatch,
} from "@/lib/validations/deal";
import type { Database, Json } from "@/types/supabase";

export type DealActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type ActivityEvent = Database["public"]["Enums"]["deal_activity_event"];

/** Append a deal_activity row (best-effort; never blocks the mutation). */
async function logDealActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    dealId: string;
    userId: string;
    event: ActivityEvent;
    payload?: Record<string, Json>;
  },
): Promise<void> {
  const { error } = await supabase.from("deal_activity").insert({
    deal_id: args.dealId,
    user_id: args.userId,
    event_type: args.event,
    payload: (args.payload ?? {}) as Json,
  });
  if (error) console.error("[deals] activity log failed:", error.message);
}

/**
 * Create a draft deal up front so the wizard can attach files across steps
 * (deal_files.deal_id is NOT NULL). The draft is excluded from lists/KPIs until
 * submitted. agent / team_lead / admin_tc only (F-031).
 */
export async function createDraftDeal(): Promise<
  DealActionResult<{ dealId: string; companyId: string }>
> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  if (!canCreateDeals(session.profile.role)) {
    return { ok: false, error: "You can't create deals." };
  }
  const companyId = session.profile.company_id;
  if (!companyId) return { ok: false, error: "No company context." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({
      company_id: companyId,
      created_by: session.user.id,
      is_draft: true,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "Could not start a new deal." };
  }
  return { ok: true, dealId: data.id, companyId };
}

/** Coerce the wizard's loose form values into typed columns. */
function toColumns(input: DealPatch) {
  const cols: Record<string, unknown> = {};
  const assign = (key: keyof DealPatch) => {
    if (key in input) cols[key] = input[key] ?? null;
  };
  (
    [
      "property_address",
      "property_city",
      "property_state",
      "property_zip",
      "client_first_name",
      "client_last_name",
      "client_email",
      "client_phone",
      "representing",
      "sales_price_cents",
      "commission_pct",
      "gci_cents",
      "rpa_signed_date",
      "inspection_contingency_days",
      "appraisal_contingency_days",
      "loan_contingency_days",
      "close_date",
      "listing_agent_id",
      "co_listing_agent_id",
      "buyer_agent_id",
      "listing_broker",
      "buy_side_broker",
      "deal_type_id",
    ] as (keyof DealPatch)[]
  ).forEach(assign);
  return cols;
}

/** Save the draft's current field values without submitting. */
export async function saveDealDraft(
  dealId: string,
  input: unknown,
): Promise<DealActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  if (!canCreateDeals(session.profile.role)) {
    return { ok: false, error: "You can't edit deals." };
  }
  // Drafts can be partial — validate loosely.
  const parsed = dealPatchSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Some fields are invalid." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ ...toColumns(parsed.data), is_draft: true })
    .eq("id", dealId);
  if (error) return { ok: false, error: "Could not save the draft." };
  return { ok: true };
}

/**
 * Finalize a draft into a real deal: validate the full payload, set the first
 * non-terminal stage, flip is_draft off, and write a "created" activity event.
 */
export async function submitDeal(
  dealId: string,
  input: unknown,
): Promise<DealActionResult<{ dealId: string }>> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  if (!canCreateDeals(session.profile.role)) {
    return { ok: false, error: "You can't submit deals." };
  }
  const parsed = dealSubmitSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please fix the form.",
    };
  }
  const supabase = await createClient();

  // Resolve the first non-terminal stage ("Submitted") for this company.
  const companyId = session.profile.company_id;
  const { data: stages } = await supabase
    .from("deal_stages")
    .select("id, name, position, is_terminal_won, is_terminal_lost, company_id")
    .or(`company_id.is.null${companyId ? `,company_id.eq.${companyId}` : ""}`)
    .order("position", { ascending: true });
  const firstStage =
    stages?.find((s) => !s.is_terminal_won && !s.is_terminal_lost) ?? null;

  const { error } = await supabase
    .from("deals")
    .update({
      ...toColumns(parsed.data),
      stage_id: firstStage?.id ?? null,
      is_draft: false,
    })
    .eq("id", dealId);
  if (error) return { ok: false, error: "Could not submit the deal." };

  await logDealActivity(supabase, {
    dealId,
    userId: session.user.id,
    event: "created",
    payload: { stage: firstStage?.name ?? null },
  });

  revalidatePath("/app/deals");
  revalidatePath(`/app/deals/${dealId}`);
  return { ok: true, dealId };
}

/** Inline edit on the detail page. Records which fields changed. */
export async function updateDealFields(
  dealId: string,
  input: unknown,
): Promise<DealActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const parsed = dealPatchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please fix the form.",
    };
  }
  const supabase = await createClient();
  const cols = toColumns(parsed.data);
  if (Object.keys(cols).length === 0) return { ok: true };

  const { error } = await supabase.from("deals").update(cols).eq("id", dealId);
  if (error) return { ok: false, error: "Could not save your changes." };

  await logDealActivity(supabase, {
    dealId,
    userId: session.user.id,
    event: "field_updated",
    payload: { fields: Object.keys(cols) as unknown as Json },
  });
  revalidatePath(`/app/deals/${dealId}`);
  return { ok: true };
}

/** Move a deal to a different stage; records from/to. */
export async function changeDealStage(
  dealId: string,
  stageId: string,
): Promise<DealActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const supabase = await createClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("stage_id, close_date")
    .eq("id", dealId)
    .single();
  const { data: stageRows } = await supabase
    .from("deal_stages")
    .select("id, name, is_terminal_won");
  const fromName =
    stageRows?.find((s) => s.id === deal?.stage_id)?.name ?? null;
  const toStage = stageRows?.find((s) => s.id === stageId) ?? null;

  const update: { stage_id: string; close_date?: string } = {
    stage_id: stageId,
  };
  // Stamp a close date when moving to the won/terminal stage if none is set.
  if (toStage?.is_terminal_won && !deal?.close_date) {
    update.close_date = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase
    .from("deals")
    .update(update)
    .eq("id", dealId);
  if (error) return { ok: false, error: "Could not change the stage." };

  await logDealActivity(supabase, {
    dealId,
    userId: session.user.id,
    event: "stage_changed",
    payload: { from: fromName, to: toStage?.name ?? null },
  });
  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app/deals");
  return { ok: true };
}

/** Toggle the public client share link flag (audit F-029). */
export async function setShareLinkEnabled(
  dealId: string,
  enabled: boolean,
): Promise<DealActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ public_share_link_enabled: enabled })
    .eq("id", dealId);
  if (error) return { ok: false, error: "Could not update the share setting." };
  revalidatePath(`/app/deals/${dealId}`);
  revalidatePath("/app/deals");
  return { ok: true };
}

/** Record a file already uploaded to storage by the browser, + activity. */
export async function recordDealFile(
  dealId: string,
  file: {
    storagePath: string;
    originalFilename: string;
    fileSizeBytes: number | null;
    contentType: string | null;
  },
): Promise<DealActionResult<{ fileId: string }>> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_files")
    .insert({
      deal_id: dealId,
      storage_path: file.storagePath,
      original_filename: file.originalFilename,
      file_size_bytes: file.fileSizeBytes,
      content_type: file.contentType,
      uploaded_by: session.user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Could not save the file." };

  await logDealActivity(supabase, {
    dealId,
    userId: session.user.id,
    event: "file_uploaded",
    payload: { filename: file.originalFilename },
  });
  revalidatePath(`/app/deals/${dealId}`);
  return { ok: true, fileId: data.id };
}

/** Delete a deal file (DB row + storage object). */
export async function deleteDealFile(
  fileId: string,
): Promise<DealActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const supabase = await createClient();
  const { data: file } = await supabase
    .from("deal_files")
    .select("id, deal_id, storage_path, original_filename")
    .eq("id", fileId)
    .single();
  if (!file) return { ok: false, error: "File not found." };

  const { error } = await supabase.from("deal_files").delete().eq("id", fileId);
  if (error) return { ok: false, error: "Could not delete the file." };
  await supabase.storage.from("deal-files").remove([file.storage_path]);

  revalidatePath(`/app/deals/${file.deal_id}`);
  return { ok: true };
}

/** Post a comment (optionally a reply) on a deal. */
export async function addDealComment(
  dealId: string,
  input: unknown,
): Promise<DealActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  const parsed = dealCommentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Write a comment first." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("deal_comments").insert({
    deal_id: dealId,
    user_id: session.user.id,
    parent_id: parsed.data.parentId ?? null,
    body: parsed.data.body,
  });
  if (error) return { ok: false, error: "Could not post your comment." };

  await logDealActivity(supabase, {
    dealId,
    userId: session.user.id,
    event: "comment_added",
    payload: {},
  });
  revalidatePath(`/app/deals/${dealId}`);
  return { ok: true };
}

/**
 * Soft-delete a deal (SR-5): team_lead and super_admin only. Sets deleted_at,
 * never hard-deletes, and writes an audit_log entry.
 */
export async function softDeleteDeal(
  dealId: string,
): Promise<DealActionResult> {
  const session = await getSessionProfile();
  if (!session) return { ok: false, error: "Your session has expired." };
  if (!canDeleteDeals(session.profile.role)) {
    return { ok: false, error: "Only a team lead can delete deals." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("deals")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", dealId);
  if (error) return { ok: false, error: "Could not delete the deal." };

  await logAudit({
    actor_user_id: session.user.id,
    action: "deal_deleted",
    resource_type: "deal",
    resource_id: dealId,
  });
  revalidatePath("/app/deals");
  return { ok: true };
}
