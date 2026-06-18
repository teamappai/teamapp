"use server";

import { revalidatePath } from "next/cache";
import { requireTeamLead } from "@/lib/auth/require-team-lead";
import type { Json } from "@/types/supabase";
import {
  createSection,
  updateSection,
  setSectionStatus,
  duplicateSection,
  reorderSections,
} from "@/lib/team/sections";
import {
  createModule,
  updateModule,
  setModuleStatus,
  moveModule,
  reorderModules,
} from "@/lib/team/modules";
import {
  createDealType,
  updateDealType,
  deleteDealType,
  createDealStage,
  updateDealStage,
  deleteDealStage,
  cloneGlobalDealStages,
  createRequestType,
  updateRequestType,
  deleteRequestType,
  reorderConfig,
  setLeaderboardVisible,
  type DealStageInput,
  type RequestTypeInput,
} from "@/lib/team/config";
import { logAudit } from "@/lib/audit/log";
import {
  sectionSchema,
  moduleSchema,
  dealTypeSchema,
  dealStageSchema,
  requestTypeSchema,
  type SectionFormInput,
  type ModuleFormInput,
} from "@/lib/validations/team";
import {
  sanitizeBlocks,
  findPlaceholders,
  scanPlaceholders,
  parseBlocks,
  hasEmoji,
  findMisspellings,
  findContentMisspellings,
  findBannedContent,
  findBannedContentInBlocks,
  bannedContentError,
} from "@/lib/team/content";

export type ActionResult =
  | { ok: true }
  | { ok: true; id: string }
  | { ok: false; error: string };

const HUB = "/app/management";

// ── sections ──────────────────────────────────────────────────────────────────
export async function saveSection(
  input: SectionFormInput & { id?: string },
): Promise<ActionResult> {
  const { companyId, profile } = await requireTeamLead();
  if (!companyId) return { ok: false, error: "No company context." };

  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }

  if (hasEmoji(parsed.data.title)) {
    return { ok: false, error: "Remove emojis from the title (F-046)." };
  }

  // CR-2: block placeholder / test content in the title and description.
  const banned = [
    ...new Set([
      ...findBannedContent(parsed.data.title),
      ...findBannedContent(parsed.data.description ?? ""),
    ]),
  ];
  if (banned.length) {
    return { ok: false, error: bannedContentError(banned) };
  }

  const placeholders = scanPlaceholders(parsed.data.title);
  if (placeholders.length) {
    return {
      ok: false,
      error: `Remove placeholder text from the title: ${placeholders.join(", ")}`,
    };
  }

  // Spell-check the title before it goes live (CR-11).
  if (parsed.data.status === "published") {
    const misspelled = findMisspellings(parsed.data.title);
    if (misspelled.length) {
      return {
        ok: false,
        error: `Fix spelling in the title before publishing: ${misspelled.join(", ")}`,
      };
    }
  }

  const result = input.id
    ? await updateSection(input.id, parsed.data)
    : await createSection(companyId, profile.id, parsed.data);
  if (!result.ok) return result;

  revalidatePath(HUB);
  return result;
}

export async function archiveSection(id: string): Promise<ActionResult> {
  await requireTeamLead();
  const res = await setSectionStatus(id, "archived");
  if (res.ok) revalidatePath(HUB);
  return res;
}

export async function duplicateSectionAction(
  id: string,
): Promise<ActionResult> {
  const { profile } = await requireTeamLead();
  const res = await duplicateSection(id, profile.id);
  if (res.ok) revalidatePath(HUB);
  return res;
}

export async function reorderSectionsAction(
  orderedIds: string[],
): Promise<ActionResult> {
  await requireTeamLead();
  const res = await reorderSections(orderedIds);
  if (res.ok) revalidatePath(HUB);
  return res;
}

// ── modules ─────────────────────────────────────────────────────────────────--
export async function saveModule(
  input: ModuleFormInput & { id?: string; content: unknown },
): Promise<ActionResult> {
  await requireTeamLead();

  const parsed = moduleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }

  if (hasEmoji(parsed.data.title)) {
    return { ok: false, error: "Remove emojis from the title (F-046)." };
  }

  // Sanitize stray formatting (F-074), then block placeholders (F-073, CR-2).
  const blocks = sanitizeBlocks(parseBlocks(input.content));

  // CR-2: block placeholder / test content in the title, description, and body.
  const banned = [
    ...new Set([
      ...findBannedContent(parsed.data.title),
      ...findBannedContent(parsed.data.description ?? ""),
      ...findBannedContentInBlocks(blocks),
    ]),
  ];
  if (banned.length) {
    return { ok: false, error: bannedContentError(banned) };
  }

  const placeholders = [
    ...new Set([
      ...scanPlaceholders(parsed.data.title),
      ...findPlaceholders(blocks),
    ]),
  ];
  if (placeholders.length) {
    return {
      ok: false,
      error: `Remove placeholder text before saving: ${placeholders.join(", ")}`,
    };
  }

  // Spell-check title + content before publishing (CR-11) — blocks "Acccepting".
  if (parsed.data.status === "published") {
    const misspelled = [
      ...new Set([
        ...findMisspellings(parsed.data.title),
        ...findContentMisspellings(blocks),
      ]),
    ];
    if (misspelled.length) {
      return {
        ok: false,
        error: `Fix spelling before publishing: ${misspelled.join(", ")}`,
      };
    }
  }

  const payload = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    sectionId: parsed.data.sectionId,
    estimatedMinutes: parsed.data.estimatedMinutes,
    recommendedTimelineDays: parsed.data.recommendedTimelineDays,
    visibleToRoles: parsed.data.visibleToRoles,
    status: parsed.data.status,
    content: blocks as unknown as Json,
  };

  const result = input.id
    ? await updateModule(input.id, payload)
    : await createModule(payload);
  if (!result.ok) return result;

  revalidatePath(HUB);
  return result;
}

export async function archiveModule(id: string): Promise<ActionResult> {
  await requireTeamLead();
  const res = await setModuleStatus(id, "archived");
  if (res.ok) revalidatePath(HUB);
  return res;
}

export async function reorderModulesAction(
  orderedIds: string[],
): Promise<ActionResult> {
  await requireTeamLead();
  const res = await reorderModules(orderedIds);
  if (res.ok) revalidatePath(HUB);
  return res;
}

export async function moveModuleAction(
  moduleId: string,
  toSectionId: string,
  toIndex: number,
): Promise<ActionResult> {
  await requireTeamLead();
  const res = await moveModule(moduleId, toSectionId, toIndex);
  if (res.ok) revalidatePath(HUB);
  return res;
}

// ── deal types ────────────────────────────────────────────────────────────────
export async function saveDealType(input: {
  id?: string;
  name: string;
}): Promise<ActionResult> {
  const { companyId } = await requireTeamLead();
  if (!companyId) return { ok: false, error: "No company context." };
  const parsed = dealTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const banned = findBannedContent(parsed.data.name);
  if (banned.length) return { ok: false, error: bannedContentError(banned) };
  const res = input.id
    ? await updateDealType(input.id, parsed.data.name)
    : await createDealType(companyId, parsed.data.name);
  if (res.ok) revalidatePath(HUB);
  return res;
}

export async function removeDealType(id: string): Promise<ActionResult> {
  await requireTeamLead();
  const res = await deleteDealType(id);
  if (res.ok) revalidatePath(HUB);
  return res;
}

// ── deal stages ─────────────────────────────────────────────────────────────--
export async function saveDealStage(
  input: DealStageInput & { id?: string },
): Promise<ActionResult> {
  const { companyId } = await requireTeamLead();
  if (!companyId) return { ok: false, error: "No company context." };
  const parsed = dealStageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const res = input.id
    ? await updateDealStage(input.id, parsed.data)
    : await createDealStage(companyId, parsed.data);
  if (res.ok) revalidatePath(HUB);
  return res;
}

export async function removeDealStage(id: string): Promise<ActionResult> {
  await requireTeamLead();
  const res = await deleteDealStage(id);
  if (res.ok) revalidatePath(HUB);
  return res;
}

export async function customizeDealStages(): Promise<ActionResult> {
  const { companyId } = await requireTeamLead();
  if (!companyId) return { ok: false, error: "No company context." };
  const res = await cloneGlobalDealStages(companyId);
  if (res.ok) revalidatePath(HUB);
  return res;
}

// ── request types ───────────────────────────────────────────────────────────--
export async function saveRequestType(
  input: RequestTypeInput & { id?: string },
): Promise<ActionResult> {
  const { companyId } = await requireTeamLead();
  if (!companyId) return { ok: false, error: "No company context." };
  const parsed = requestTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  const banned = findBannedContent(parsed.data.name);
  if (banned.length) return { ok: false, error: bannedContentError(banned) };
  const res = input.id
    ? await updateRequestType(input.id, parsed.data)
    : await createRequestType(companyId, parsed.data);
  if (res.ok) revalidatePath(HUB);
  return res;
}

export async function removeRequestType(id: string): Promise<ActionResult> {
  await requireTeamLead();
  const res = await deleteRequestType(id);
  if (res.ok) revalidatePath(HUB);
  return res;
}

export async function reorderConfigAction(
  table: "deal_types" | "deal_stages" | "request_types",
  orderedIds: string[],
): Promise<ActionResult> {
  await requireTeamLead();
  const res = await reorderConfig(table, orderedIds);
  if (res.ok) revalidatePath(HUB);
  return res;
}

// ── company settings ──────────────────────────────────────────────────────────
export async function setLeaderboardVisibilityAction(
  enabled: boolean,
): Promise<ActionResult> {
  const { user, companyId } = await requireTeamLead();
  if (!companyId) return { ok: false, error: "No company context." };
  const res = await setLeaderboardVisible(companyId, enabled);
  if (!res.ok) return res;
  await logAudit({
    actor_user_id: user.id,
    action: "leaderboard_visibility_changed",
    resource_type: "company",
    resource_id: companyId,
    metadata: { enabled },
  });
  revalidatePath(HUB);
  revalidatePath("/app/coaching");
  return { ok: true };
}

// ── image / file uploads for the module editor ────────────────────────────────
export async function getModuleUploadContext(): Promise<
  { ok: true; companyId: string } | { ok: false; error: string }
> {
  const { companyId } = await requireTeamLead();
  if (!companyId) return { ok: false, error: "No company context." };
  return { ok: true, companyId };
}
