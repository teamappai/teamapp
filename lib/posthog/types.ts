/**
 * PostHog event taxonomy — the single source of truth for event names and their
 * property shapes (Phase 15). Imported by both the browser helper
 * (`lib/posthog/client.ts`) and the server helper (`lib/posthog/server.ts`) so
 * every capture call site is type-checked against the same contract.
 *
 * Convention (audit "PostHog instrumentation plan" §3): `noun_verb_past_tense`,
 * snake_case, include a `role` property wherever a role is in scope. 27 events
 * total — see `lib/posthog/README.md` for the human-readable catalog.
 */
import type { UserRole } from "@/lib/constants/roles";
import type { ActivityMetricKey } from "@/lib/constants/activity-metrics";

export type DeviceType = "desktop" | "mobile" | "tablet";

/** Per-day activity metric counts, keyed by the `activity_logs` column names. */
type ActivityMetricCounts = { [K in ActivityMetricKey]?: number };

export interface EventMap {
  // ── E1 · Auth (SR-4) ──────────────────────────────────────────────────────
  login_attempted: {
    device_type: DeviceType;
    browser: string;
    success: boolean;
  };
  login_failed: {
    device_type: DeviceType;
    error_code: string;
    error_message: string;
  };

  // ── E2 · Training (PA-2, F-060, F-067) ────────────────────────────────────
  training_module_viewed: {
    module_id: string;
    section_id: string | null;
    role: UserRole;
  };
  training_module_completed: {
    module_id: string;
    section_id: string | null;
    time_to_complete_seconds: number | null;
  };
  training_section_completed: {
    section_id: string;
    modules_count: number;
  };

  // ── E3 · Activity (PA-5, F-113) ───────────────────────────────────────────
  activity_log_opened: {
    source: "sidebar" | "reminder" | "nudge" | "streak_notification";
    role: UserRole;
  };
  activity_log_submitted: ActivityMetricCounts & {
    total_activities: number;
    streak_day_count: number;
    is_off_day: boolean;
  };
  activity_log_streak_broken: {
    previous_streak: number;
    last_logged_at: string | null;
    agent_id: string;
  };

  // ── E4 · Deals (F-080, SR-1, SR-2) ────────────────────────────────────────
  deal_form_opened: {
    source: "add_button" | "ai_upload" | "dashboard_quick_action";
  };
  deal_ai_extraction_completed: {
    fields_extracted_count: number;
    fields_corrected_count: number;
    file_count: number;
  };
  deal_submitted: {
    representing: string;
    sales_price_cents: number | null;
    gci_cents: number | null;
    has_ai_extracted_fields: boolean;
    time_in_form_seconds: number | null;
    stage_at_submit: string | null;
  };
  deal_form_abandoned: {
    last_field_touched: string | null;
    time_in_form_seconds: number;
    fields_filled_count: number;
  };

  // ── E5 · Requests (PA-4, F-127, F-137) ────────────────────────────────────
  request_created: {
    request_type: string;
    assigned_to_role: UserRole | null;
    has_attachments: boolean;
    has_due_date: boolean;
  };
  request_status_changed: {
    request_id: string;
    from_status: string;
    to_status: string;
  };
  request_completed: {
    request_type: string;
    time_open_hours: number | null;
  };

  // ── E6 · Coaching (PA-5, PA-7) ────────────────────────────────────────────
  coaching_dashboard_viewed: {
    role: UserRole;
    date_range_filter: string | null;
  };
  coaching_funnel_stage_drilled: {
    stage_name: string;
  };
  agent_nudge_sent: {
    agent_id: string;
    nudge_type:
      | "no_activity"
      | "below_goal"
      | "stalled_deal"
      | "stalled_training"
      | "custom";
  };

  // ── E7 · Billing (CR-3, F-092, F-099) ─────────────────────────────────────
  billing_dashboard_viewed: Record<string, never>;
  unsubscribe_initiated: Record<string, never>;
  unsubscribe_completed: {
    company_id?: string;
  };
  seats_added: {
    seats_added_count: number;
    new_total_seats: number;
  };

  // ── E8 · Channels (Phase 11.5) ────────────────────────────────────────────
  channel_joined: {
    channel_id: string;
    channel_type: "public" | "private";
    source: "browse" | "invite";
  };
  mention_sent: {
    mention_type: "@user" | "@channel";
    channel_id: string;
  };

  // ── E9 · Playbooks (Phase 12.5) ───────────────────────────────────────────
  playbook_browsed: {
    source: "library" | "onboarding";
  };
  playbook_installed: {
    playbook_id: string;
    install_count_after: number;
  };

  // ── E10 · Errors & dead-ends (F-001, F-073, F-066) ────────────────────────
  placeholder_content_viewed: {
    content_text: string;
    location: string;
  };
}

export type EventName = keyof EventMap;
