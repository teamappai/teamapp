import { describe, expect, it } from "vitest";

import type { EventMap, EventName } from "@/lib/posthog/types";

/**
 * Compile-time contract checks for the PostHog event taxonomy (Phase 15 §I1).
 * These assertions are mostly TYPE-LEVEL: if a property shape drifts, `tsc`
 * fails before vitest even runs. The runtime body keeps vitest happy and pins
 * the event count.
 */

// A representative, fully-typed payload per event. If any event's property
// shape changes incompatibly, this object stops compiling.
const SAMPLES: { [E in EventName]: EventMap[E] } = {
  login_attempted: { device_type: "mobile", browser: "chrome", success: true },
  login_failed: {
    device_type: "mobile",
    error_code: "invalid_credentials",
    error_message: "Incorrect email or password.",
  },
  training_module_viewed: { module_id: "m1", section_id: "s1", role: "agent" },
  training_module_completed: {
    module_id: "m1",
    section_id: "s1",
    time_to_complete_seconds: 120,
  },
  training_section_completed: { section_id: "s1", modules_count: 4 },
  activity_log_opened: { source: "sidebar", role: "agent" },
  activity_log_submitted: {
    total_activities: 10,
    streak_day_count: 3,
    is_off_day: false,
    door_knocks: 5,
  },
  activity_log_streak_broken: {
    previous_streak: 4,
    last_logged_at: "2026-06-01",
    agent_id: "u1",
  },
  deal_form_opened: { source: "add_button" },
  deal_ai_extraction_completed: {
    fields_extracted_count: 8,
    fields_corrected_count: 0,
    file_count: 1,
  },
  deal_submitted: {
    representing: "buyer",
    sales_price_cents: 50000000,
    gci_cents: 1500000,
    has_ai_extracted_fields: true,
    time_in_form_seconds: 90,
    stage_at_submit: "Submitted",
  },
  deal_form_abandoned: {
    last_field_touched: "client_email",
    time_in_form_seconds: 45,
    fields_filled_count: 6,
  },
  request_created: {
    request_type: "Transaction Coordination",
    assigned_to_role: "admin_tc",
    has_attachments: false,
    has_due_date: true,
  },
  request_status_changed: {
    request_id: "r1",
    from_status: "pending",
    to_status: "in_progress",
  },
  request_completed: { request_type: "TC", time_open_hours: 12.5 },
  coaching_dashboard_viewed: { role: "team_lead", date_range_filter: "30d" },
  coaching_funnel_stage_drilled: { stage_name: "conversations" },
  agent_nudge_sent: { agent_id: "u1", nudge_type: "no_activity" },
  billing_dashboard_viewed: {},
  unsubscribe_initiated: {},
  unsubscribe_completed: { company_id: "c1" },
  seats_added: { seats_added_count: 2, new_total_seats: 27 },
  channel_joined: {
    channel_id: "ch1",
    channel_type: "public",
    source: "browse",
  },
  mention_sent: { mention_type: "@channel", channel_id: "ch1" },
  playbook_browsed: { source: "library" },
  playbook_installed: { playbook_id: "p1", install_count_after: 3 },
  placeholder_content_viewed: {
    content_text: "TODO finish copy",
    location: "training_module:m1",
  },
};

describe("EventMap taxonomy", () => {
  it("defines exactly 27 events", () => {
    expect(Object.keys(SAMPLES)).toHaveLength(27);
  });

  it("uses snake_case noun_verb_past_tense names", () => {
    for (const name of Object.keys(SAMPLES)) {
      expect(name).toMatch(/^[a-z]+(_[a-z0-9]+)+$/);
    }
  });

  it("includes the acceptance-critical events", () => {
    const names = Object.keys(SAMPLES);
    expect(names).toContain("activity_log_submitted");
    expect(names).toContain("deal_submitted");
    expect(names).toContain("login_attempted");
  });
});
