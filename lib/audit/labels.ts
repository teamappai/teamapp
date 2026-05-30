/**
 * Human-readable labels for audit actions and resource types. Kept separate
 * from lib/audit/log.ts (which is server-only) so both client components and
 * Server Components can render audit entries.
 */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  impersonate_started: "Started impersonation",
  impersonate_ended: "Ended impersonation",
  company_suspended: "Suspended company",
  company_canceled: "Canceled company",
  company_restored: "Restored company",
  invite_resent: "Resent invite",
  feature_flag_toggled: "Toggled feature flag",
  feature_flag_companies_updated: "Updated flag overrides",
  super_admin_note_created: "Added note",
  super_admin_note_deleted: "Deleted note",
  training_nudge_sent: "Sent training nudge",
  deal_deleted: "Deleted deal",
  request_status_changed: "Changed request status",
  request_deleted: "Deleted request",
};

export function auditActionLabel(action: string): string {
  return (
    AUDIT_ACTION_LABELS[action] ??
    action
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}
