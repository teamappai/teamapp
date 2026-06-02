"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import {
  PLANS,
  PLAN_ORDER,
  formatPrice,
  annualMonthlyEquivalentCents,
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
    features: string[];
    upsell?: string;
    cta: { label: string; href: string };
  }
> = {
  launch: {
    features: [
      "5 user seats included",
      "Deal flow + AI extraction",
      "Coaching dashboard",
      "Daily activity log",
      "Marketing requests",
      "Real-time messaging",
    ],
    upsell:
      "Upgrade to Pro for the Client Portal, 25 seats, and advanced coaching analytics.",
    cta: { label: "Start free trial", href: "/demo" },
  },
  pro: {
    highlight: true,
    features: [
      "25 user seats included",
      "Everything in Launch, plus:",
      "Client Portal (coming soon)",
      "Advanced coaching analytics (coming soon)",
      "Bulk operations (coming soon)",
      "Priority support",
    ],
    upsell:
      "Need 50+ seats, SSO, or a dedicated success manager? Talk to sales about Enterprise.",
    cta: { label: "Start free trial", href: "/demo" },
  },
  enterprise: {
    features: [
      "50+ team members",
      "Everything in Pro, plus:",
      "Dedicated success manager",
      "Custom training & onboarding",
      "Custom integrations",
      "SSO support",
      "Custom contract terms",
    ],
    cta: { label: "Talk to sales", href: "mailto:phil@teamapp.ai" },
  },
};

export function PricingCards() {
  const [cycle, setCycle] = React.useState<BillingCycle>("monthly");

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
          Get 2 months free with annual billing
        </p>
      </div>

      {/* Plan cards */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const content = PLAN_CONTENT[planId];
          // Extra seats are always billed + shown monthly, even on annual.
          const seatRate = plan.additional_seat_price_cents;
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

                {plan.custom ? (
                  <>
                    <div className="mt-5">
                      <span className="text-3xl font-semibold tracking-tight">
                        Custom pricing
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {plan.fit ?? "Tailored to your organization"}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mt-5">
                      <span className="text-4xl font-semibold tracking-tight">
                        {cycle === "annual"
                          ? formatPrice(annualMonthlyEquivalentCents(plan))
                          : formatPrice(plan.monthly_price_cents)}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {" "}
                        /month
                      </span>
                    </div>
                    {cycle === "annual" ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Billed yearly at {formatPrice(plan.annual_price_cents)}{" "}
                        <span className="text-primary font-medium">
                          · 2 months free
                        </span>
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-1 text-xs">
                        billed monthly
                      </p>
                    )}

                    <p className="mt-4 text-sm font-medium">
                      Includes {plan.included_seats} seats
                    </p>
                    <p className="text-muted-foreground text-xs">
                      then {formatPrice(seatRate)}/user/month for extra seats
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
