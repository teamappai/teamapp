import type { Metadata } from "next";
import Link from "next/link";

import { getSessionProfile } from "@/lib/auth/profile";
import { NotAuthorizedError } from "@/lib/auth/require-super-admin";
import { scopedTitle } from "@/lib/constants/roles";
import { canCreateDeals, canViewDeals } from "@/lib/deals/access";
import {
  listDealsForScope,
  listStages,
  listDealTypes,
  listCompanyUsers,
  primaryAgent,
} from "@/lib/deals/queries";
import { computeKpis } from "@/lib/kpi/definitions";
import { formatDealId, stageStatusKey } from "@/lib/deals/format";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/admin/kpi-card";
import { Button } from "@/components/ui/button";
import { DealsTable, type DealListItem } from "@/components/deals/deals-table";

export const metadata: Metadata = { title: "Deals · TeamApp" };

export default async function DealsPage() {
  const session = await getSessionProfile();
  if (!session || !canViewDeals(session.profile.role)) {
    throw new NotAuthorizedError();
  }
  const role = session.profile.role;
  const companyId = session.profile.company_id;

  const [deals, stages, types, users] = await Promise.all([
    listDealsForScope({ role, companyId, userId: session.user.id }),
    listStages(companyId),
    listDealTypes(companyId),
    listCompanyUsers(companyId),
  ]);

  // KPIs are computed over the full scoped set (not the client-side filtered
  // view) so the totals stay stable as the user filters.
  const kpis = computeKpis(
    deals.map((d) => ({
      gci_cents: d.gci_cents,
      sales_price_cents: d.sales_price_cents,
      close_date: d.close_date,
      stage: d.stage,
    })),
    { year: new Date().getFullYear() },
  );

  const showCompany = role === "super_admin";

  const items: DealListItem[] = deals.map((d) => {
    const agent = primaryAgent(d);
    const agentIds = [
      d.created_by,
      d.listing_agent_id,
      d.co_listing_agent_id,
      d.buyer_agent_id,
    ].filter((x): x is string => !!x);
    return {
      id: d.id,
      displayId: formatDealId(d.id),
      propertyAddress: d.property_address,
      propertyCity: d.property_city,
      propertyState: d.property_state,
      propertyZip: d.property_zip,
      clientFirstName: d.client_first_name,
      clientLastName: d.client_last_name,
      agentName: agent?.full_name ?? null,
      agentAvatar: agent?.avatar_url ?? null,
      agentSeed: agent?.id ?? null,
      stageId: d.stage_id,
      stageName: d.stage?.name ?? null,
      stageStatus: stageStatusKey(d.stage?.name),
      representing: d.representing,
      dealTypeId: d.deal_type_id,
      salesPriceCents: d.sales_price_cents,
      gciCents: d.gci_cents,
      closeDate: d.close_date,
      createdAt: d.created_at,
      companyName: d.company?.name ?? null,
      shareLinkEnabled: d.public_share_link_enabled,
      agentIds,
    };
  });

  const title = scopedTitle(
    role,
    {
      super_admin: "All Deals",
      team_lead: "Team Deals",
      admin_tc: "Company Deals",
      agent: "My Deals",
    },
    "Deals",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Transactions across your pipeline."
        action={
          canCreateDeals(role) ? (
            <Button asChild>
              <Link href="/app/deals/new">+ Add New Deal</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.helperText}
          />
        ))}
      </div>

      <DealsTable
        items={items}
        stages={stages.map((s) => ({ id: s.id, name: s.name }))}
        nonTerminalStageIds={stages
          .filter((s) => !s.is_terminal_won && !s.is_terminal_lost)
          .map((s) => s.id)}
        dealTypes={types}
        agents={users.map((u) => ({
          id: u.id,
          name: u.full_name ?? "Unnamed",
        }))}
        showCompany={showCompany}
      />
    </div>
  );
}
