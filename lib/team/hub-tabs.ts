/** Management Hub sub-tabs. Shared by the server page and the client hub so the
 * value is a real array on the server (a client-module import would proxy it). */
export const HUB_TABS = [
  { value: "sections", label: "Sections" },
  { value: "modules", label: "Modules" },
  { value: "deal-types", label: "Deal Types" },
  { value: "deal-stages", label: "Deal Stages" },
  { value: "request-types", label: "Request Types" },
  { value: "company-settings", label: "Company Settings" },
] as const;

export type HubTab = (typeof HUB_TABS)[number]["value"];

export function resolveHubTab(value: string | undefined): HubTab {
  const match = HUB_TABS.find((t) => t.value === value);
  return match ? match.value : "sections";
}
