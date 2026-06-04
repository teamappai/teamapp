"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CreditCard,
  Download,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  XCircle,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusChip } from "@/components/shared/status-chip";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { seatBand } from "@/lib/billing/seat-utils";
import type { PlanId, BillingCycle } from "@/lib/billing/plans";
import type { PaymentMethodSummary, InvoiceSummary } from "@/lib/billing/state";
import { pauseSubscriptionAction, resumeSubscriptionAction } from "./actions";
import { openPortal } from "./portal-button";
import { PlansTab } from "./plans-tab";
import { capture } from "@/lib/posthog/client";
import { HistoryTab } from "./history-tab";

export type BillingData = {
  planId: PlanId;
  planName: string;
  cycle: BillingCycle;
  status: string;
  renewalDate: string | null;
  trialEndsAt: string | null;
  cancellationScheduledFor: string | null;
  seats: {
    used: number;
    total: number;
    activeUsers: number;
    pendingInvites: number;
    pct: number;
    available: number;
  };
  paymentMethod: PaymentMethodSummary | null;
  latestInvoice: InvoiceSummary | null;
  invoices: InvoiceSummary[];
  invoicesHasMore: boolean;
  stripeConfigured: boolean;
  hasSubscription: boolean;
};

const BAND_BAR: Record<string, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  critical: "bg-red-500",
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function BillingTabs({ data }: { data: BillingData }) {
  // Deep-link support: /app/billing?tab=plans opens the Plans tab directly
  // (used by the playbook plan-cap modal's "Upgrade to Pro" CTA).
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "plans" ? "plans" : "overview";
  const [tab, setTab] = React.useState(initialTab);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="plans">Plans</TabsTrigger>
        <TabsTrigger value="history">Billing history</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab data={data} onManagePlan={() => setTab("plans")} />
      </TabsContent>

      <TabsContent value="plans">
        <PlansTab data={data} />
      </TabsContent>

      <TabsContent value="history">
        <HistoryTab data={data} />
      </TabsContent>
    </Tabs>
  );
}

function OverviewTab({
  data,
  onManagePlan,
}: {
  data: BillingData;
  onManagePlan: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const band = seatBand(data.seats.pct);
  const trialDays =
    data.status === "trialing" ? daysUntil(data.trialEndsAt) : null;

  async function pause() {
    setPending(true);
    const res = await pauseSubscriptionAction();
    setPending(false);
    if (res.ok) {
      toast.success(res.message ?? "Subscription paused.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function resume() {
    setPending(true);
    const res = await resumeSubscriptionAction();
    setPending(false);
    if (res.ok) {
      toast.success(res.message ?? "Subscription resumed.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="space-y-4">
      {/* Past-due / cancellation banners */}
      {data.status === "past_due" ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              Payment failed. Update your payment method to avoid service
              interruption.
            </span>
            <Button size="sm" variant="outline" onClick={() => openPortal()}>
              Update payment method
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {data.status === "cancellation_scheduled" &&
      data.cancellationScheduledFor ? (
        <Alert>
          <AlertDescription>
            Your subscription is scheduled to cancel on{" "}
            {formatDate(data.cancellationScheduledFor, "long")}. You keep full
            access until then.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Current plan card */}
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Current plan
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg font-semibold">{data.planName}</span>
                  <StatusChip domain="company" status={data.status} />
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  {data.cycle === "annual" ? "Annual" : "Monthly"} billing
                  {data.renewalDate
                    ? ` · renews ${formatDate(data.renewalDate, "short")}`
                    : ""}
                  {trialDays != null
                    ? ` · ${trialDays} days left in trial`
                    : ""}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Manage subscription"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {data.status === "paused" ? (
                    <DropdownMenuItem onClick={resume} disabled={pending}>
                      <PlayCircle className="size-4" /> Resume subscription
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={pause} disabled={pending}>
                      <PauseCircle className="size-4" /> Pause subscription
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/app/billing/cancel"
                      onClick={() => capture("unsubscribe_initiated", {})}
                    >
                      <XCircle className="size-4" /> Cancel subscription
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Seats used</span>
                <span className="font-medium">
                  {data.seats.used} / {data.seats.total}
                </span>
              </div>
              <Progress
                value={Math.min(100, data.seats.pct)}
                indicatorClassName={BAND_BAR[band]}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onManagePlan}>Manage plan</Button>
              <Button variant="outline" onClick={() => openPortal()}>
                Update payment method
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment method card */}
        <Card>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Payment method
            </p>
            {data.paymentMethod ? (
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="text-muted-foreground size-4" />
                <span className="font-medium">
                  {capitalize(data.paymentMethod.brand)} ending in{" "}
                  {data.paymentMethod.last4}
                </span>
                <span className="text-muted-foreground">
                  — expires{" "}
                  {String(data.paymentMethod.expMonth).padStart(2, "0")}/
                  {String(data.paymentMethod.expYear).slice(-2)}
                </span>
              </div>
            ) : (
              <div className="text-sm">
                <span className="text-muted-foreground">
                  No payment method on file —{" "}
                </span>
                <button
                  className="text-primary font-medium underline-offset-2 hover:underline"
                  onClick={() => openPortal()}
                >
                  Add one
                </button>
              </div>
            )}

            {/* Last invoice */}
            <div className="border-t pt-3">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                Latest invoice
              </p>
              {data.latestInvoice ? (
                <p className="mt-1 text-sm">
                  {formatCurrency(data.latestInvoice.amountCents)} (
                  {formatDate(
                    new Date(data.latestInvoice.created * 1000).toISOString(),
                    "short",
                  )}
                  ){" "}
                  {data.latestInvoice.pdfUrl ? (
                    <a
                      href={data.latestInvoice.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                    >
                      <Download className="size-3.5" /> Download PDF
                    </a>
                  ) : null}
                </p>
              ) : (
                <p className="text-muted-foreground mt-1 text-sm">
                  No invoices yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Seat usage card with threshold banners */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Seat usage
            </p>
            <span className="text-sm font-medium">
              {data.seats.activeUsers} active · {data.seats.pendingInvites}{" "}
              invited
            </span>
          </div>
          <Progress
            value={Math.min(100, data.seats.pct)}
            indicatorClassName={BAND_BAR[band]}
          />
          <p className="text-muted-foreground text-sm">
            {data.seats.used} of {data.seats.total} seats used ({data.seats.pct}
            %)
          </p>

          {band !== "ok" ? (
            <Alert variant={band === "critical" ? "destructive" : "default"}>
              <AlertDescription className="flex items-center justify-between gap-4">
                <span>
                  You&rsquo;re using {data.seats.used} of {data.seats.total}{" "}
                  seats. Add more before you hit the cap.
                </span>
                <Button size="sm" variant="outline" onClick={onManagePlan}>
                  Add seats
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {!data.stripeConfigured ? (
        <p className="text-muted-foreground text-xs">
          Billing is in test mode — connect Stripe keys to enable live actions.
        </p>
      ) : null}
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
