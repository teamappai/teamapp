import { z } from "zod";
import { ACTIVITY_METRICS } from "@/lib/constants/activity-metrics";

/**
 * Validation for Coaching + Activity Log (Phase 10). Shared between the client
 * forms and the server actions so the two never drift.
 */

// ── Activity Log ────────────────────────────────────────────────────────────────

/** Non-negative integer stepper value (fixes F-115 — never a text input). */
const metricValue = z
  .number({ message: "Enter a whole number." })
  .int("Must be a whole number.")
  .min(0, "Can't be negative.")
  .max(1000, "That seems too high.");

// One required field per manual metric, keyed by activity_logs column name.
const metricsShape = Object.fromEntries(
  ACTIVITY_METRICS.map((m) => [m.key, metricValue]),
) as Record<(typeof ACTIVITY_METRICS)[number]["key"], typeof metricValue>;

export const activityLogSchema = z.object({
  // Calendar day the log is for. Range is checked server-side against
  // [today-30, today] using the request clock (fixes F-112 / back-dating rules).
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  isOffDay: z.boolean(),
  metrics: z.object(metricsShape),
});

export type ActivityLogInput = z.infer<typeof activityLogSchema>;

// ── Coaching notes ──────────────────────────────────────────────────────────────

export const coachingNoteSchema = z.object({
  agentUserId: z.string().uuid("Pick an agent."),
  body: z.string().trim().min(1, "Write a note first.").max(4000),
});

// ── Nudges ──────────────────────────────────────────────────────────────────────

export const NUDGE_REASONS = [
  { value: "stalled_activity", label: "Stalled activity" },
  { value: "below_goal_pace", label: "Below goal pace" },
  { value: "stalled_training", label: "Stalled training" },
  { value: "custom", label: "Custom" },
] as const;

export const nudgeSchema = z.object({
  agentUserId: z.string().uuid("Pick an agent."),
  reason: z.enum([
    "stalled_activity",
    "below_goal_pace",
    "stalled_training",
    "custom",
  ]),
  customMessage: z.string().trim().max(2000).optional().default(""),
});

// ── Goals ───────────────────────────────────────────────────────────────────────

export const goalUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  /** null = team-wide goal; otherwise the agent the goal is for. */
  userId: z.string().uuid().nullable(),
  goalType: z.enum([
    "gci_cents",
    "closed_volume_cents",
    "closed_deals_count",
    "conversations_count",
    "appointments_count",
    "top_of_funnel_count",
    "listings_signed_count",
    "buyer_agreements_signed_count",
    "pqs_count",
    "showings_count",
    "offers_submitted_count",
  ]),
  period: z.enum(["monthly", "quarterly", "annual"]),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
  /** Stored value: cents for currency goals, a count otherwise. >= 0 integer. */
  targetValue: z
    .number({ message: "Enter a target." })
    .int()
    .min(0, "Target can't be negative."),
});

export type GoalUpsertInput = z.infer<typeof goalUpsertSchema>;
