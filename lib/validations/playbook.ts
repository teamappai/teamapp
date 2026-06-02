import { z } from "zod";
import type { UserRole } from "@/lib/constants/roles";

/**
 * Phase 12.5 playbook validation. Module/section content reuses the Phase 7
 * block schema and the same placeholder/emoji/spelling rules (enforced in the
 * server actions, mirroring app/app/management/actions.ts).
 */

const userRole = z.custom<UserRole>(
  (v) =>
    typeof v === "string" &&
    ["super_admin", "team_lead", "agent", "admin_tc", "marketing"].includes(v),
);

/**
 * Slug: lowercase letters, numbers, single hyphens. Generated from the title by
 * default but editable + uniqueness-checked server-side.
 */
export const playbookSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required.")
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens.",
  );

export const playbookMetadataSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(100),
  slug: playbookSlugSchema,
  description: z.string().trim().max(500).optional().or(z.literal("")),
  category: z.string().trim().min(1, "Category is required.").max(80),
  iconName: z.string().trim().max(60).optional().or(z.literal("")),
  coverGradient: z.string().trim().max(80).optional().or(z.literal("")),
  creditText: z.string().trim().max(200).optional().or(z.literal("")),
  recommendedForOnboarding: z.boolean(),
});
export type PlaybookMetadataInput = z.infer<typeof playbookMetadataSchema>;

export const playbookSectionSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  visibleToRoles: z.array(userRole),
  estimatedMinutes: z.number().int().min(0).max(100000).nullable(),
  recommendedTimelineDays: z.number().int().min(0).max(3650).nullable(),
});
export type PlaybookSectionInput = z.infer<typeof playbookSectionSchema>;

export const playbookModuleSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  sectionId: z.string().uuid("Choose a section."),
  estimatedMinutes: z.number().int().min(0).max(100000).nullable(),
  visibleToRoles: z.array(userRole),
});
export type PlaybookModuleInput = z.infer<typeof playbookModuleSchema>;

/** Slugify a title into a candidate slug (the new-playbook form default). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
