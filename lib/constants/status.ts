/**
 * Single source of truth for mapping every domain status to a visual chip
 * variant (audit CR-8, F-039, F-053, F-016, F-033, F-045). The UI must never
 * invent its own per-screen status colors — render <StatusChip> with one of
 * these domains so a "completed" request looks the same everywhere.
 */

export type StatusVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export type StatusDomain =
  | "deal"
  | "request"
  | "user"
  | "company"
  | "training"
  | "training_publish";

const DEAL: Record<string, StatusVariant> = {
  submitted: "info",
  under_review: "info",
  active: "success",
  under_contract: "info",
  closed: "success",
  // Terminal-lost family (Phase 10): Trash maps to "lost" via stageStatusKey;
  // Cancelled/Expired keep their own keys. "Pending" was merged into Under
  // Contract and is gone.
  cancelled: "danger",
  expired: "danger",
  lost: "danger",
};

const REQUEST: Record<string, StatusVariant> = {
  pending: "neutral",
  in_progress: "info",
  ready_for_review: "warning",
  completed: "success",
  rejected: "danger",
};

const USER: Record<string, StatusVariant> = {
  invited: "warning",
  active: "success",
  archived: "neutral",
};

const COMPANY: Record<string, StatusVariant> = {
  trialing: "info",
  active: "success",
  past_due: "warning",
  canceled: "danger",
  paused: "neutral",
};

const TRAINING: Record<string, StatusVariant> = {
  not_started: "neutral",
  in_progress: "info",
  completed: "success",
};

// Publish lifecycle. NEVER label this "Publish" — it's "Published" (audit F-045).
const TRAINING_PUBLISH: Record<string, StatusVariant> = {
  draft: "neutral",
  published: "success",
  archived: "neutral",
};

const STATUS_VARIANTS: Record<StatusDomain, Record<string, StatusVariant>> = {
  deal: DEAL,
  request: REQUEST,
  user: USER,
  company: COMPANY,
  training: TRAINING,
  training_publish: TRAINING_PUBLISH,
};

/** Resolve a domain status to its chip variant (defaults to "default"). */
export function statusVariant(
  domain: StatusDomain,
  status: string,
): StatusVariant {
  return STATUS_VARIANTS[domain][status] ?? "default";
}

/** "ready_for_review" -> "Ready For Review". */
export function humanizeStatus(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
