import { z } from "zod";
import type { UserRole } from "@/lib/constants/roles";

/**
 * Roles a team_lead may invite. team_lead and super_admin are provisioned by
 * the platform owner, never via the invite flow (per spec + CSV rules).
 */
export const INVITABLE_ROLES = ["agent", "admin_tc", "marketing"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** Short descriptions shown beneath each role in the invite dropdown (F-107). */
export const ROLE_DESCRIPTIONS: Record<InvitableRole, string> = {
  agent:
    "Submits and manages their own deals, completes training, logs activity.",
  admin_tc:
    "Transaction coordinator — handles requests and deal paperwork across the team.",
  marketing:
    "Handles marketing requests (flyers, social) and team-wide assets.",
};

const invitableRole = z.enum(INVITABLE_ROLES);

export const singleInviteSchema = z.object({
  fullName: z.string().trim().min(1, "Enter a full name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  role: invitableRole,
  welcomeMessage: z.string().trim().max(1000).optional().or(z.literal("")),
  assignedModuleIds: z.array(z.string().uuid()).optional(),
});
export type SingleInviteInput = z.infer<typeof singleInviteSchema>;

/** One row of a bulk invite (paste or CSV), after parsing + per-row override. */
export const bulkInviteRowSchema = z.object({
  fullName: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().toLowerCase().email(),
  role: invitableRole,
});
export type BulkInviteRow = z.infer<typeof bulkInviteRowSchema>;

export const BULK_INVITE_MAX = 100;

export const bulkInviteSchema = z.object({
  rows: z
    .array(bulkInviteRowSchema)
    .min(1, "Add at least one invitee.")
    .max(BULK_INVITE_MAX, `Up to ${BULK_INVITE_MAX} invitees per batch.`),
  welcomeMessage: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type BulkInviteInput = z.infer<typeof bulkInviteSchema>;

export const editUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(1, "Enter a full name.").max(120),
  role: z.custom<UserRole>(),
});
export type EditUserInput = z.infer<typeof editUserSchema>;

// ── management hub ────────────────────────────────────────────────────────────
const publishStatus = z.enum(["draft", "published", "archived"]);
const userRole = z.custom<UserRole>(
  (v) =>
    typeof v === "string" &&
    ["super_admin", "team_lead", "agent", "admin_tc", "marketing"].includes(v),
);

export const sectionSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  visibleToRoles: z.array(userRole),
  status: publishStatus,
});
export type SectionFormInput = z.infer<typeof sectionSchema>;

export const moduleSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  sectionId: z.string().uuid("Choose a section."),
  estimatedMinutes: z.number().int().min(0).max(100000).nullable(),
  recommendedTimelineDays: z.number().int().min(0).max(3650).nullable(),
  visibleToRoles: z.array(userRole),
  status: publishStatus,
});
export type ModuleFormInput = z.infer<typeof moduleSchema>;

export const dealTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
});

export const dealStageSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(120),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #3b82f6.")
      .nullable(),
    isTerminalWon: z.boolean(),
    isTerminalLost: z.boolean(),
  })
  .refine((v) => !(v.isTerminalWon && v.isTerminalLost), {
    message: "A stage can't be both won and lost.",
    path: ["isTerminalLost"],
  });

export const requestTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  defaultAssigneeRole: userRole.nullable(),
  category: z
    .enum(["agent_support", "field_work", "transaction_admin", "other"])
    .default("other"),
});
