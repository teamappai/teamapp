"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import {
  PLANS,
  PLAN_ORDER,
  formatPrice,
  annualDiscountPct,
  type BillingCycle,
  type PlanId,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils/index";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Per-plan marketing content. Pricing numbers are NEVER hardcoded here — they
 * are read live from `@/lib/billing/plans` (the source of truth). Only the
 * positive inclusion bullets and CTA copy live here. Features are framed as
 * what you GET; absent features are surfaced as an upgrade prompt, never as
 * "No access to X" (audit F-100).
 */
const PLAN_CONTENT: Record<
  PlanId,
  {
    highlight?: boolean;
    /** Hide the real price on the public page and show a "Custom pricing"
     * label instead. The canonical price still lives in plans.ts. */
    custom?: boolean;
    features: string[];
    upsell?: string;
    cta: { label: string; href: string };
  }
> = {
  launch: {
    features: [
      "Deal flow & pipeline tracking",
      "AI contract extraction",
      "Training playbooks",
      "Marketing requests queue",
      "Mobile activity logging",
      "Email support",
    ],
    upsell: "Upgrade to Pro for the coaching dashboard and advanced analytics.",
    cta: { label: "Start free trial", href: "/demo" },
  },
  pro: {
    highlight: true,
    features: [
      "Everything in Launch",
      "Coaching dashboard",
      "Advanced training analytics",
      "Team performance reporting",
      "Priority support",
    ],
    upsell:
      "Upgrade to Brokerage for multi-team management and a dedicated success manager.",
    cta: { label: "Start free trial", href: "/demo" },
  },
  brokerage: {
    custom: true,
    features: [
      "Everything in Pro",
      "Multi-team management",
      "Dedicated onboarding",
      "Dedicated success manager",
      "Custom training libraries",
    ],
    cta: { label: "Talk to sales", href: "/contact" },
  },
};

function priceParts(planId: PlanId, cycle: BillingCycle) {
  const plan = PLANS[planId];
  const perMonthCents =
    cycle === "annual"
      ? Math.round(plan.annual_price_cents / 12)
      : plan.monthly_price_cents;
  const seatCents =
    cycle === "annual"
      ? Math.round(plan.additional_seat_annual_price_cents / 12)
      : plan.additional_seat_price_cents;
  return {
    perMonth: formatPrice(perMonthCents),
    seat: formatPrice(seatCents),
    seats: plan.included_seats,
    annualTotal: formatPrice(plan.annual_price_cents),
    discount: annualDiscountPct(plan),
  };
}

export function PricingCards() {
  const [cycle, setCycle] = React.useState<BillingCycle>("monthly");
  // Every plan in plans.ts is configured at the same 20% annual discount; read
  // it from the first plan rather than hardcoding the number.
  const savingsPct = annualDiscountPct(PLANS[PLAN_ORDER[0]]);

  return (
    <div>
      {/* Billing-cycle toggle */}
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
                "focus-visible:ring-ring/50 rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
                cycle === value
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">
          Save {savingsPct}% with annual billing
        </p>
      </div>

      {/* Plan cards */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const content = PLAN_CONTENT[planId];
          const p = priceParts(planId, cycle);
          return (
            <Card
              key={planId}
              className={cn(
                "relative flex h-full flex-col",
                content.highlight && "border-primary shadow-md",
              )}
            >
              {content.highlight ? (
                <span className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium">
                  Most popular
                </span>
              ) : null}
              <CardContent className="flex flex-1 flex-col p-6">
                <h3 className="text-lg font-semibold">{plan.display_name}</h3>
                <p className="text-muted-foreground mt-1 text-sm text-pretty">
                  {plan.tagline}
                </p>

                {content.custom ? (
                  <>
                    <div className="mt-5">
                      <span className="text-3xl font-semibold tracking-tight">
                        Custom pricing
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Tailored to your brokerage
                    </p>

                    <p className="mt-4 text-sm font-medium">
                      Includes {p.seats} seats
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Volume seat pricing — let&rsquo;s talk
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-5">
                      <span className="text-4xl font-semibold tracking-tight">
                        {p.perMonth}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {" "}
                        /month
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {cycle === "annual"
                        ? `${p.annualTotal} billed annually`
                        : "billed monthly"}
                    </p>

                    <p className="mt-4 text-sm font-medium">
                      Includes {p.seats} seats
                    </p>
                    <p className="text-muted-foreground text-xs">
                      then {p.seat}/seat per month
                    </p>
                  </>
                )}

                <ul className="mt-6 space-y-3">
                  {content.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <Check
                        className="text-primary mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {content.upsell ? (
                  <p className="text-muted-foreground mt-6 text-xs text-pretty">
                    {content.upsell}
                  </p>
                ) : null}

                <div className="mt-6 flex-1" />
                <Button
                  asChild
                  className="w-full"
                  variant={content.highlight ? "default" : "outline"}
                >
                  <Link href={content.cta.href}>{content.cta.label}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-6 text-center text-xs">
        All plans are invitation-based. Start a free trial and we&rsquo;ll get
        your team set up.
      </p>
    </div>
  );
}
