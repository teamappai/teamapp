import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/supabase";

export type FeatureFlag = Database["public"]["Tables"]["feature_flags"]["Row"];

/**
 * The seven feature-flag keys this phase seeds (from the audit's PostHog plan).
 * The editor builds rows for any flags missing from the DB so the full set is
 * always manageable even before a re-seed. Consuming code lands in later phases.
 */
export const SEED_FLAG_KEYS = [
  "flag_role_based_sections",
  "flag_training_dashboard",
  "flag_drag_drop_reorder",
  "flag_redesigned_requests",
  "flag_lightweight_coaching",
  "flag_team_lead_dashboard_v2",
  "flag_new_billing_ux",
] as const;

export const FLAG_DESCRIPTIONS: Record<string, string> = {
  flag_role_based_sections: "Role-scoped training section visibility.",
  flag_training_dashboard: "New training progress dashboard.",
  flag_drag_drop_reorder: "Drag-and-drop reordering of sections/modules.",
  flag_redesigned_requests: "Redesigned requests queue UX.",
  flag_lightweight_coaching: "Lightweight coaching log experience.",
  flag_team_lead_dashboard_v2: "Rebuilt team-lead dashboard (Phase 13).",
  flag_new_billing_ux: "New billing UX (Phase 12).",
};

export type CompanyOption = { id: string; name: string };

export type FlagsData = {
  flags: FeatureFlag[];
  companies: CompanyOption[];
};

/** All feature flags + the company list used by the per-company override UI. */
export async function getFlagsData(): Promise<FlagsData> {
  const service = createServiceClient();

  const [flagsRes, companiesRes] = await Promise.all([
    service.from("feature_flags").select("*").order("key", { ascending: true }),
    service
      .from("companies")
      .select("id, name")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  return {
    flags: flagsRes.data ?? [],
    companies: companiesRes.data ?? [],
  };
}
