import { z } from "zod";
import type { UserRole } from "@/lib/constants/roles";

/**
 * Request form validation (Phase 9). Shared between the client form and the
 * server actions. A request ALWAYS has a real request_type (no "All Types"
 * sentinel — audit F-125/F-137) and a real assignee (a user OR a role queue).
 */

const userRole = z.custom<UserRole>(
  (v) =>
    typeof v === "string" &&
    ["super_admin", "team_lead", "agent", "admin_tc", "marketing"].includes(v),
);

const priority = z.enum(["low", "normal", "high", "urgent"]);

/** Names we never accept as a real type, even if one slipped into the table. */
const SENTINEL_TYPE_NAMES = new Set(["all types", "default", "any", "none"]);

export function isSentinelTypeName(name: string): boolean {
  return SENTINEL_TYPE_NAMES.has(name.trim().toLowerCase());
}

export const createRequestSchema = z
  .object({
    requestTypeId: z
      .string({ message: "Select a request type." })
      .uuid("Select a request type."),
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters.")
      .max(200, "Title must be 200 characters or fewer."),
    description: z
      .string()
      .trim()
      .max(8000)
      .optional()
      .transform((v) => (v && v.length ? v : null))
      .nullable(),
    priority: priority.default("normal"),
    // YYYY-MM-DD or empty → null (optional; "best effort"). Never defaults to
    // today server-side (audit F-140).
    dueDate: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length ? v : null))
      .nullable(),
    relatedDealId: z
      .string()
      .uuid()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    assignedToUserId: z
      .string()
      .uuid()
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v ? v : null)),
    assignedToRole: userRole
      .optional()
      .nullable()
      .or(z.literal(""))
      .transform((v) => (v ? (v as UserRole) : null)),
  })
  .refine((v) => v.assignedToUserId || v.assignedToRole, {
    message: "Assign this request to a person or a role queue.",
    path: ["assignedToUserId"],
  });

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

/** Inline edits on the detail page (all fields optional). */
export const updateRequestSchema = z.object({
  title: z.string().trim().min(3, "Title is too short.").max(200).optional(),
  description: z
    .string()
    .trim()
    .max(8000)
    .optional()
    .transform((v) => (v && v.length ? v : null))
    .nullable(),
  priority: priority.optional(),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length ? v : null))
    .nullable(),
  relatedDealId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  assignedToUserId: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  assignedToRole: userRole
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? (v as UserRole) : null)),
});
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;

export const requestCommentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment.").max(4000),
});

export const requestStatusSchema = z.object({
  to: z.enum([
    "pending",
    "in_progress",
    "ready_for_review",
    "completed",
    "rejected",
  ]),
  note: z.string().trim().max(1000).optional(),
});
