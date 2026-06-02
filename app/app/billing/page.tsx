import Link from "next/link";
import type { Metadata } from "next";

import { requireTeamLead } from "@/lib/auth/require-team-lead";
import {
  getCompany,
  getPaymentMethod,
  getLatestInvoice,
  listInvoices,
} from "@/lib/billing/state";
import { getSeatUsage } from "@/lib/billing/seats";
import { isStripeConfigured } from "@/lib/billing/env";
import { getPlan, type PlanId, type BillingCycle } from "@/lib/billing/plans";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BillingTabs, type BillingData } from "./billing-tabs";

export const metadata: Metadata = { title: "Billing | TeamApp" };

export default async function BillingPage() {
  const ctx = await requireTeamLead();

  // Super admins have no company of their own — point them to the admin console.
  if (!ctx.companyId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              Super admins manage company billing from the admin console.
            </p>
            <Button asChild variant="outline">
              <Link href="/app/admin/companies">Go to Companies</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const company = await getCompany(ctx.companyId);
  if (!company) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            We couldn&rsquo;t load your billing details. Please try again.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [usage, paymentMethod, latestInvoice, firstPage] = await Promise.all([
    getSeatUsage(ctx.companyId, company.seats_total),
    getPaymentMethod(company.stripe_customer_id),
    getLatestInvoice(company.stripe_customer_id),
    listInvoices(company.stripe_customer_id, { limit: 25 }),
  ]);

  const planId = company.plan as PlanId;
  const data: BillingData = {
    planId,
    planName: getPlan(planId).display_name,
    cycle: (company.billing_cycle as BillingCycle | null) ?? "monthly",
    status: company.status,
    renewalDate: company.current_period_end,
    trialEndsAt: company.trial_ends_at,
    cancellationScheduledFor: company.cancellation_scheduled_for,
    seats: {
      used: usage.used,
      total: usage.total,
      activeUsers: usage.activeUsers,
      pendingInvites: usage.pendingInvites,
      pct: usage.pct,
      available: usage.available,
    },
    paymentMethod,
    latestInvoice,
    invoices: firstPage.invoices,
    invoicesHasMore: firstPage.hasMore,
    stripeConfigured: isStripeConfigured(),
    hasSubscription: Boolean(company.stripe_subscription_id),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground text-sm">
          Manage your plan, seats, payment method, and invoices.
        </p>
      </div>
      <BillingTabs data={data} />
    </div>
  );
}
