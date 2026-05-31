/**
 * The canonical Daily Activity Log metric set (HomeReady-validated, Phase 10).
 *
 * Keys are the literal `activity_logs` column names so the form, the upsert,
 * and the funnel aggregation all share one vocabulary with no mapping layer.
 * Each metric carries a precise definition (audit F-117) rendered as a tooltip
 * beside its stepper; keep definitions here so they stay maintainable.
 *
 * 15 manual metrics across three funnel groups (PA-5). Pipeline also surfaces
 * five DERIVED, read-only metrics pulled from deals — those are computed in
 * lib/coaching/pipeline.ts, not entered here.
 */

export type ActivityGroupKey = "top_of_funnel" | "appointments" | "pipeline";

/** Every manually-entered metric key (== activity_logs integer column). */
export type ActivityMetricKey =
  | "door_knocks"
  | "open_houses"
  | "conversations"
  | "seller_leads_added"
  | "buyer_leads_added"
  | "pqs"
  | "buyer_consults"
  | "listing_appts"
  | "cma_deliveries"
  | "zillow_appts_set"
  | "zillow_appts_met"
  | "showings"
  | "listings_signed"
  | "buyer_agreements_signed"
  | "offers_submitted";

export type ActivityMetric = {
  key: ActivityMetricKey;
  label: string;
  group: ActivityGroupKey;
  /** Precise definition shown in the info tooltip (audit F-117). */
  tooltip: string;
};

export type ActivityGroup = {
  key: ActivityGroupKey;
  label: string;
  /** Short subtitle clarifying the funnel intent of the group. */
  subtitle: string;
  /** Top of Funnel is expanded by default; the others start collapsed. */
  defaultOpen: boolean;
};

export const ACTIVITY_GROUPS: readonly ActivityGroup[] = [
  {
    key: "top_of_funnel",
    label: "Top of Funnel",
    subtitle: "Volume — how many people you reached",
    defaultOpen: true,
  },
  {
    key: "appointments",
    label: "Appointments",
    subtitle: "Intent — meetings that move people forward",
    defaultOpen: false,
  },
  {
    key: "pipeline",
    label: "Pipeline",
    subtitle: "Committed — daily counts (per-deal pipeline lives on Deals)",
    defaultOpen: false,
  },
] as const;

export const ACTIVITY_METRICS: readonly ActivityMetric[] = [
  // ── Top of Funnel (volume) ──────────────────────────────────────────────
  {
    key: "door_knocks",
    label: "Door Knocks",
    group: "top_of_funnel",
    tooltip:
      "Houses you physically visited to introduce yourself or ask about real estate needs. Count each door knocked, not households spoken to.",
  },
  {
    key: "open_houses",
    label: "Open Houses",
    group: "top_of_funnel",
    tooltip:
      "Open houses you hosted as the lead agent. Don't count houses you attended as a visiting agent.",
  },
  {
    key: "conversations",
    label: "Conversations",
    group: "top_of_funnel",
    tooltip:
      "Phone calls, texts, in-person convos with potential clients. Don't count emails or DMs.",
  },
  {
    key: "seller_leads_added",
    label: "Seller Leads Added",
    group: "top_of_funnel",
    tooltip: "Potential seller contacts added to your CRM or database today.",
  },
  {
    key: "buyer_leads_added",
    label: "Buyer Leads Added",
    group: "top_of_funnel",
    tooltip: "Potential buyer contacts added to your CRM or database today.",
  },
  {
    key: "pqs",
    label: "PQ's",
    group: "top_of_funnel",
    tooltip:
      "Pre-qualification letters obtained for buyer clients. Counts each new PQ document, not status checks.",
  },
  // ── Appointments (intent) ───────────────────────────────────────────────
  {
    key: "buyer_consults",
    label: "Buyer Consultations",
    group: "appointments",
    tooltip:
      "Sit-down meetings (in-person or video) with a buyer to define their search.",
  },
  {
    key: "listing_appts",
    label: "Listing Appointments",
    group: "appointments",
    tooltip:
      "Sit-down meetings with prospective sellers, including listing presentations.",
  },
  {
    key: "cma_deliveries",
    label: "CMA Deliveries",
    group: "appointments",
    tooltip:
      "Comparative Market Analyses prepared and presented to potential sellers.",
  },
  {
    key: "zillow_appts_set",
    label: "Zillow Appointments Set",
    group: "appointments",
    tooltip:
      "Appointments scheduled via Zillow Flex assignment, regardless of attendance.",
  },
  {
    key: "zillow_appts_met",
    label: "Zillow Appointments Met",
    group: "appointments",
    tooltip:
      "Appointments scheduled via Zillow Flex where the buyer actually attended.",
  },
  // ── Pipeline (committed, manual entry) ──────────────────────────────────
  {
    key: "showings",
    label: "Showings",
    group: "pipeline",
    tooltip:
      "Property showings you personally attended with a buyer client. Don't count drive-bys.",
  },
  {
    key: "listings_signed",
    label: "Listings Signed",
    group: "pipeline",
    tooltip:
      "Listing agreements signed by sellers, dated today. Count each signed agreement.",
  },
  {
    key: "buyer_agreements_signed",
    label: "Buyer Agreements Signed",
    group: "pipeline",
    tooltip: "Formal buyer representation agreements signed today.",
  },
  {
    key: "offers_submitted",
    label: "Offers Submitted",
    group: "pipeline",
    tooltip: "Written offers submitted on behalf of buyer clients today.",
  },
] as const;

/** Metrics belonging to a funnel group, in display order. */
export function metricsForGroup(group: ActivityGroupKey): ActivityMetric[] {
  return ACTIVITY_METRICS.filter((m) => m.group === group);
}

/** The metric keys that make up each funnel group (for summing). */
export const GROUP_METRIC_KEYS: Record<ActivityGroupKey, ActivityMetricKey[]> =
  {
    top_of_funnel: metricsForGroup("top_of_funnel").map((m) => m.key),
    appointments: metricsForGroup("appointments").map((m) => m.key),
    pipeline: metricsForGroup("pipeline").map((m) => m.key),
  };

/** Sum of all 15 manual metric values on a single log row. */
export function totalActivity(
  row: Partial<Record<ActivityMetricKey, number>>,
): number {
  return ACTIVITY_METRICS.reduce((sum, m) => sum + (row[m.key] ?? 0), 0);
}

/** Zeroed values for every manual metric (the empty form / off-day payload). */
export function zeroMetrics(): Record<ActivityMetricKey, number> {
  return ACTIVITY_METRICS.reduce(
    (acc, m) => {
      acc[m.key] = 0;
      return acc;
    },
    {} as Record<ActivityMetricKey, number>,
  );
}
