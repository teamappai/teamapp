"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { logAudit } from "@/lib/audit/log";
import type { Json } from "@/types/supabase";
import type { PlaybookStatus } from "@/lib/constants/playbooks";
import {
  playbookMetadataSchema,
  playbookSectionSchema,
  playbookModuleSchema,
  type PlaybookMetadataInput,
  type PlaybookSectionInput,
  type PlaybookModuleInput,
} from "@/lib/validations/playbook";
import {
  createPlaybook,
  updatePlaybookMetadata,
  setPlaybookStatus,
  isSlugTaken,
} from "@/lib/playbooks/playbooks";
import {
  createPlaybookSection,
  updatePlaybookSection,
  deletePlaybookSection,
  reorderPlaybookSections,
  createPlaybookModule,
  updatePlaybookModule,
  deletePlaybookModule,
  reorderPlaybookModules,
} from "@/lib/playbooks/content";
import {
  sanitizeBlocks,
  findPlaceholders,
  scanPlaceholders,
  parseBlocks,
  hasEmoji,
  findMisspellings,
  findContentMisspellings,
  findBannedAuthoredContent,
  bannedContentError,
} from "@/lib/team/content";

export type ActionResult =
  | { ok: true }
  | { ok: true; id: string }
  | { ok: false; error: string };

const LIST = "/app/admin/playbooks";
const detail = (id: string) => `${LIST}/${id}`;

// ── playbook metadata ─────────────────────────────────────────────────────────
export async function createPlaybookAction(
  input: PlaybookMetadataInput,
): Promise<ActionResult> {
  const { profile } = await requireSuperAdmin();
  const parsed = playbookMetadataSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  if (hasEmoji(parsed.data.title)) {
    return { ok: false, error: "Remove emojis from the title." };
  }
  if (await isSlugTaken(parsed.data.slug)) {
    return { ok: false, error: "That slug is already in use." };
  }
  const res = await createPlaybook(parsed.data, profile.id);
  if (!res.ok) return res;
  revalidatePath(LIST);
  return { ok: true, id: res.id };
}

export async function updatePlaybookMetadataAction(
  id: string,
  input: PlaybookMetadataInput,
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = playbookMetadataSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  if (hasEmoji(parsed.data.title)) {
    return { ok: false, error: "Remove emojis from the title." };
  }
  if (await isSlugTaken(parsed.data.slug, id)) {
    return { ok: false, error: "That slug is already in use." };
  }
  const res = await updatePlaybookMetadata(id, parsed.data);
  if (!res.ok) return res;
  revalidatePath(detail(id));
  revalidatePath(LIST);
  return { ok: true };
}

export async function setPlaybookStatusAction(
  id: string,
  status: PlaybookStatus,
): Promise<ActionResult> {
  const { profile } = await requireSuperAdmin();
  const res = await setPlaybookStatus(id, status);
  if (!res.ok) return res;
  if (status === "published") {
    await logAudit({
      actor_user_id: profile.id,
      action: "playbook_published",
      resource_type: "playbook",
      resource_id: id,
      metadata: { playbook_id: id, title: res.title },
    });
  } else if (status === "archived") {
    await logAudit({
      actor_user_id: profile.id,
      action: "playbook_archived",
      resource_type: "playbook",
      resource_id: id,
      metadata: { playbook_id: id, title: res.title },
    });
  }
  revalidatePath(detail(id));
  revalidatePath(LIST);
  return { ok: true };
}

// ── sections ──────────────────────────────────────────────────────────────────
export async function savePlaybookSectionAction(
  playbookId: string,
  input: PlaybookSectionInput & { id?: string },
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = playbookSectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  if (hasEmoji(parsed.data.title)) {
    return { ok: false, error: "Remove emojis from the title." };
  }
  // CR-2: block placeholder / test content in the title and description before
  // it can be installed into a company's training_modules.
  const banned = findBannedAuthoredContent({
    title: parsed.data.title,
    description: parsed.data.description,
  });
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
  const misspelled = findMisspellings(parsed.data.title);
  if (misspelled.length) {
    return {
      ok: false,
      error: `Fix spelling in the title: ${misspelled.join(", ")}`,
    };
  }

  const res = input.id
    ? await updatePlaybookSection(input.id, parsed.data)
    : await createPlaybookSection(playbookId, parsed.data);
  if (!res.ok) return res;
  revalidatePath(detail(playbookId));
  return res;
}

export async function deletePlaybookSectionAction(
  playbookId: string,
  sectionId: string,
): Promise<ActionResult> {
  await requireSuperAdmin();
  const res = await deletePlaybookSection(sectionId);
  if (res.ok) revalidatePath(detail(playbookId));
  return res;
}

export async function reorderPlaybookSectionsAction(
  playbookId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  await requireSuperAdmin();
  const res = await reorderPlaybookSections(orderedIds);
  if (res.ok) revalidatePath(detail(playbookId));
  return res;
}

// ── modules ─────────────────────────────────────────────────────────────────--
export async function savePlaybookModuleAction(
  playbookId: string,
  input: PlaybookModuleInput & { id?: string; content: unknown },
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = playbookModuleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid." };
  }
  if (hasEmoji(parsed.data.title)) {
    return { ok: false, error: "Remove emojis from the title." };
  }

  // Same content rules as the Phase 7 module editor (F-073/F-074/CR-2/CR-11).
  const blocks = sanitizeBlocks(parseBlocks(input.content));

  // CR-2: block placeholder / test content in the title, description, and body
  // before it can be deep-copied into a company's training_modules on install.
  const banned = findBannedAuthoredContent({
    title: parsed.data.title,
    description: parsed.data.description,
    blocks,
  });
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
  const misspelled = [
    ...new Set([
      ...findMisspellings(parsed.data.title),
      ...findContentMisspellings(blocks),
    ]),
  ];
  if (misspelled.length) {
    return {
      ok: false,
      error: `Fix spelling before saving: ${misspelled.join(", ")}`,
    };
  }

  const payload = {
    title: parsed.data.title,
    description: parsed.data.description || null,
    sectionId: parsed.data.sectionId,
    estimatedMinutes: parsed.data.estimatedMinutes,
    visibleToRoles: parsed.data.visibleToRoles,
    content: blocks as unknown as Json,
  };
  const res = input.id
    ? await updatePlaybookModule(input.id, payload)
    : await createPlaybookModule(payload);
  if (!res.ok) return res;
  revalidatePath(detail(playbookId));
  return res;
}

export async function deletePlaybookModuleAction(
  playbookId: string,
  moduleId: string,
): Promise<ActionResult> {
  await requireSuperAdmin();
  const res = await deletePlaybookModule(moduleId);
  if (res.ok) revalidatePath(detail(playbookId));
  return res;
}

export async function reorderPlaybookModulesAction(
  playbookId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  await requireSuperAdmin();
  const res = await reorderPlaybookModules(orderedIds);
  if (res.ok) revalidatePath(detail(playbookId));
  return res;
}
