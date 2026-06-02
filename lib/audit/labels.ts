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
  subscription_created: "Subscription created",
  plan_upgraded: "Upgraded plan",
  plan_downgraded: "Downgraded plan",
  downgrade_scheduled: "Scheduled downgrade",
  seats_changed: "Changed seat count",
  subscription_paused: "Paused subscription",
  subscription_resumed: "Resumed subscription",
  payment_failed: "Payment failed",
  payment_recovered: "Payment recovered",
  cancellation_scheduled: "Scheduled cancellation",
  cancellation_completed: "Completed cancellation",
  seats_threshold_notified: "Sent seat-usage alert",
  admin_trial_extended: "Extended trial",
  admin_credit_applied: "Applied credit",
  admin_company_suspended: "Force-suspended company",
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
