import type { Database } from "@/types/supabase";
import type { StatusVariant } from "@/lib/constants/status";

/**
 * Display + workflow helpers for Requests. Status colors themselves live in
 * lib/constants/status.ts (StatusChip domain="request"); this file owns the
 * kanban ordering, priority/category labels, and the upload constraints.
 */

export type RequestStatus = Database["public"]["Enums"]["request_status"];
export type RequestPriority = Database["public"]["Enums"]["request_priority"];
export type RequestCategory =
  | "agent_support"
  | "field_work"
  | "transaction_admin"
  | "other";

/** The forward kanban flow (audit F-127). `rejected` is a side-exit via overflow. */
export const STATUS_FLOW: RequestStatus[] = [
  "pending",
  "in_progress",
  "ready_for_review",
  "completed",
];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  ready_for_review: "Ready for Review",
  completed: "Completed",
  rejected: "Rejected",
};

/** The next forward status from the current one, or null at the end / for rejected. */
export function nextStatus(current: RequestStatus): RequestStatus | null {
  const i = STATUS_FLOW.indexOf(current);
  if (i === -1 || i === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1]!;
}

export const PRIORITIES: RequestPriority[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_VARIANT: Record<RequestPriority, StatusVariant> = {
  low: "neutral",
  normal: "default",
  high: "warning",
  urgent: "danger",
};

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  agent_support: "Agent Support",
  field_work: "Field Work",
  transaction_admin: "Transaction Admin",
  other: "Other",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as RequestCategory] ?? "Other";
}

// ── attachments (audit F-130) ─────────────────────────────────────────────────
export const MAX_REQUEST_FILE_MB = 20;

/** Allowed upload types: PNG, JPG, PDF, DOCX, AI, PSD, FIG. */
export const REQUEST_FILE_ACCEPT = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".docx",
  ".ai",
  ".psd",
  ".fig",
].join(",");

export const REQUEST_FILE_HINT =
  "PNG, JPG, PDF, DOCX, AI, PSD, FIG · up to 20MB each";
