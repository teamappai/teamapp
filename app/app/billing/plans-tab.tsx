"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils/index";
import { formatDate } from "@/lib/utils/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  PLANS,
  PLAN_ORDER,
  getPlan,
  planRank,
  extraSeats,
  extraSeatsMonthlyCents,
  formatPrice,
  annualMonthlyEquivalentCents,
  type PlanId,
  type BillingCycle,
} from "@/lib/billing/plans";
import type { BillingData } from "./billing-tabs";
import { changePlan, scheduleDowngrade } from "./actions";

/** Positive, app-side plan features (audit F-100 — never "No access to X"). */
const FEATURES: Record<PlanId, string[]> = {
  launch: [
    "5 user seats included",
    "Deal flow + AI extraction",
    "Coaching dashboard",
    "Daily activity log",
    "Marketing requests",
    "Real-time messaging",
  ],
  pro: [
    "25 user seats included",
    "Everything in Launch, plus:",
    "Client Portal (coming soon)",
    "Advanced coaching analytics (coming soon)",
    "Bulk operations (coming soon)",
    "Priority support",
  ],
  enterprise: [
    "50+ team members",
    "Everything in Pro, plus:",
    "Dedicated success manager",
    "Custom training & onboarding",
    "Custom integrations",
    "SSO support",
    "Custom contract terms",
  ],
};

const UPSELL: Partial<Record<PlanId, string>> = {
  launch:
    "Upgrade to Pro for: Client Portal, +20 seats, advanced coaching analytics.",
};

type DialogState = {
  plan: PlanId;
  mode: "upgrade" | "downgrade" | "seats";
} | null;

export function PlansTab({ data }: { data: BillingData }) {
  const [cycle, setCycle] = React.useState<BillingCycle>(data.cycle);
  const [dialog, setDialog] = React.useState<DialogState>(null);

  return (
    <div className="space-y-6">
      {/* Monthly | Annual toggle */}
      <div className="flex flex-col items-center gap-2">
        <div
          role="radiogroup"
          aria-label="Billing cycle"
          className="bg-muted inline-flex rounded-lg p-1"
        >
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={cycle === value}
              onClick={() => setCycle(value)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                cycle === value
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "monthly" ? "Monthly" : "Annual (2 months free)"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const isCurrent = planId === data.planId;
          const rank = planRank(planId);
          const currentRank = planRank(data.planId);
          // Extra seats are always billed + shown monthly, even on annual.
          const perSeat = plan.additional_seat_price_cents;

          return (
            <Card
              key={planId}
              className={cn(
                "relative flex h-full flex-col",
                isCurrent && "border-primary",
              )}
            >
              <CardContent className="flex flex-1 flex-col p-6">
                <h3 className="text-lg font-semibold">{plan.display_name}</h3>

                {plan.custom ? (
                  <div className="mt-3">
                    <span className="text-3xl font-semibold tracking-tight">
                      Custom pricing
                    </span>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {plan.fit}
                    </p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <span className="text-3xl font-semibold tracking-tight">
                      {cycle === "annual"
                        ? formatPrice(annualMonthlyEquivalentCents(plan))
                        : formatPrice(plan.monthly_price_cents)}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {" "}
                      /month
                    </span>
                    {cycle === "annual" ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        billed yearly at {formatPrice(plan.annual_price_cents)}{" "}
                        <span className="text-primary font-medium">
                          · 2 months free
                        </span>
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-1 text-xs">
                        billed monthly
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatPrice(perSeat)}/user/month for extra seats
                    </p>
                  </div>
                )}

                <ul className="mt-5 space-y-2.5">
                  {FEATURES[planId].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check
                        className="text-primary mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {UPSELL[planId] ? (
                  <p className="text-muted-foreground mt-4 text-xs text-pretty">
                    {UPSELL[planId]}
                  </p>
                ) : null}

                <div className="mt-6 flex-1" />

                {/* CTA per F-092 / F-103: current = neutral chip; up = filled
                    primary; down = text link; enterprise = talk to sales. */}
                {plan.custom ? (
                  isCurrent ? (
                    <CurrentChip />
                  ) : (
                    <Button asChild variant="outline" className="w-full">
                      <a href="mailto:phil@teamapp.ai?subject=TeamApp%20Enterprise">
                        Talk to sales
                      </a>
                    </Button>
                  )
                ) : isCurrent ? (
                  <CurrentChip />
                ) : rank > currentRank ? (
                  <Button
                    className="w-full"
                    onClick={() => setDialog({ plan: planId, mode: "upgrade" })}
                  >
                    Upgrade
                  </Button>
                ) : (
                  <button
                    className="text-muted-foreground hover:text-foreground mx-auto text-sm underline-offset-2 hover:underline"
                    onClick={() =>
                      setDialog({ plan: planId, mode: "downgrade" })
                    }
                  >
                    Downgrade
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {dialog ? (
        <ChangePlanDialog
          data={data}
          target={dialog}
          cycle={cycle}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function CurrentChip() {
  return (
    <span className="bg-muted text-muted-foreground inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium">
      Current Plan
    </span>
  );
}

function ChangePlanDialog({
  data,
  target,
  cycle,
  onClose,
}: {
  data: BillingData;
  target: NonNullable<DialogState>;
  cycle: BillingCycle;
  onClose: () => void;
}) {
  const router = useRouter();
  const plan = getPlan(target.plan);
  const minSeats = Math.max(plan.included_seats, data.seats.used);
  const [seats, setSeats] = React.useState(
    target.mode === "downgrade" ? plan.included_seats : minSeats,
  );
  const [pending, setPending] = React.useState(false);

  const isDowngrade = target.mode === "downgrade";
  // Base bills per the chosen cycle; extra seats ALWAYS bill monthly (shown as
  // a separate monthly line so customers never see annual seat "sticker shock").
  const baseCents =
    cycle === "annual" ? plan.annual_price_cents : plan.monthly_price_cents;
  const extraCount = extraSeats(target.plan, seats);
  const extraMonthlyCents = extraSeatsMonthlyCents(target.plan, seats);

  async function confirm() {
    setPending(true);
    try {
      if (isDowngrade) {
        const res = await scheduleDowngrade({
          plan: target.plan,
          cycle,
          seats,
        });
        if (res.ok) {
          toast.success(res.message ?? "Downgrade scheduled.");
          onClose();
          router.refresh();
        } else {
          toast.error(res.error);
        }
        return;
      }

      const res = await changePlan({ plan: target.plan, cycle, seats });
      if (res.ok && "needsCheckout" in res) {
        // No subscription yet → route through Checkout to capture a card.
        const checkout = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: target.plan, cycle, seats }),
        });
        const body = (await checkout.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (body.url) {
          window.location.href = body.url;
        } else {
          toast.error(body.error ?? "Could not start checkout.");
        }
        return;
      }
      if (res.ok) {
        toast.success(res.message ?? "Plan updated.");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDowngrade ? "Downgrade to" : "Upgrade to"} {plan.display_name}
          </DialogTitle>
          <DialogDescription>
            {isDowngrade
              ? `Scheduled for the end of your current billing period${
                  data.renewalDate
                    ? ` (${formatDate(data.renewalDate, "short")})`
                    : ""
                }. You keep your current features until then.`
              : "Confirm your plan, billing cycle, and seat count. Charges are prorated."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2 text-sm">
            <span className="text-muted-foreground">Billing cycle</span>
            <span className="font-medium">
              {cycle === "annual" ? "Annual (2 months free)" : "Monthly"}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seat-count">Seats</Label>
            <Input
              id="seat-count"
              type="number"
              min={isDowngrade ? plan.included_seats : minSeats}
              value={seats}
              onChange={(e) =>
                setSeats(Math.max(0, parseInt(e.target.value || "0", 10)))
              }
            />
            <p className="text-muted-foreground text-xs">
              {plan.display_name} includes {plan.included_seats} seats.
              {!isDowngrade && data.seats.used > plan.included_seats
                ? ` You currently use ${data.seats.used}.`
                : ""}
            </p>
          </div>

          <div className="space-y-2 border-t pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {plan.display_name} base
              </span>
              <span className="font-semibold">
                {formatPrice(baseCents)}
                <span className="text-muted-foreground text-xs font-normal">
                  /{cycle === "annual" ? "year" : "month"}
                </span>
              </span>
            </div>
            {extraCount > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {extraCount} additional seat{extraCount === 1 ? "" : "s"} ×{" "}
                  {formatPrice(plan.additional_seat_price_cents)}/month
                </span>
                <span className="font-semibold">
                  {formatPrice(extraMonthlyCents)}
                  <span className="text-muted-foreground text-xs font-normal">
                    /month
                  </span>
                </span>
              </div>
            ) : null}
            {cycle === "annual" && extraCount > 0 ? (
              <p className="text-muted-foreground text-xs">
                Extra seats bill monthly even on annual plans.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={pending}>
            {pending
              ? "Working…"
              : isDowngrade
                ? "Schedule downgrade"
                : "Confirm upgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
