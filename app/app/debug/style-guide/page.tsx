import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Inbox, Pencil } from "lucide-react";

import { getSessionProfile } from "@/lib/auth/profile";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from "@/lib/utils/format";
import {
  humanizeStatus,
  type StatusDomain,
  type StatusVariant,
} from "@/lib/constants/status";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { ExtLink } from "@/components/shared/ext-link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Style Guide · TeamApp" };

const VARIANTS: StatusVariant[] = [
  "default",
  "info",
  "success",
  "warning",
  "danger",
  "neutral",
];

const DOMAIN_STATUSES: Record<StatusDomain, string[]> = {
  deal: [
    "submitted",
    "under_review",
    "active",
    "pending",
    "under_contract",
    "closed",
    "lost",
  ],
  request: [
    "pending",
    "in_progress",
    "ready_for_review",
    "completed",
    "rejected",
  ],
  user: ["invited", "active", "archived"],
  company: ["trialing", "active", "past_due", "canceled", "paused"],
  training: ["not_started", "in_progress", "completed"],
  training_publish: ["draft", "published", "archived"],
};

const SAMPLE_DATE = new Date(2026, 4, 10, 14, 30);

const CURRENCY_SAMPLES: Array<[string, string]> = [
  ["formatCurrency(0)", formatCurrency(0)],
  ["formatCurrency(25000000)", formatCurrency(25000000)],
  ["formatCurrency(123456700)", formatCurrency(123456700)],
  ["formatCurrency(-50000)", formatCurrency(-50000)],
  [
    "formatCurrency(123456700, { compact })",
    formatCurrency(123456700, { compact: true }),
  ],
  [
    "formatCurrency(25000000, { compact })",
    formatCurrency(25000000, { compact: true }),
  ],
  ["formatCurrency(0, { compact })", formatCurrency(0, { compact: true })],
];

const OTHER_SAMPLES: Array<[string, string]> = [
  ['formatDate(d, "short")', formatDate(SAMPLE_DATE, "short")],
  ['formatDate(d, "long")', formatDate(SAMPLE_DATE, "long")],
  ['formatDate(d, "iso")', formatDate(SAMPLE_DATE, "iso")],
  [
    'formatDate(now-2h, "relative")',
    formatDate(new Date(Date.now() - 7_200_000), "relative"),
  ],
  ["formatPercent(42.7)", formatPercent(42.7)],
  ["formatPercent(42.75, 1)", formatPercent(42.75, 1)],
  ["formatNumber(1234567)", formatNumber(1234567)],
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="rounded-lg border p-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <code className="text-muted-foreground">{label}</code>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function StyleGuidePage() {
  // Reference page for the design primitives — super_admin only.
  const session = await getSessionProfile();
  if (!session || session.profile.role !== "super_admin") notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Style Guide"
        description="Reference for shared design primitives. super_admin only."
      />

      <Section title="StatusChip — variants">
        <div className="flex flex-wrap gap-2">
          {VARIANTS.map((v) => (
            <StatusChip key={v} variant={v}>
              {v}
            </StatusChip>
          ))}
        </div>
      </Section>

      <Section title="StatusChip — domain status mappings">
        <div className="space-y-4">
          {(Object.keys(DOMAIN_STATUSES) as StatusDomain[]).map((domain) => (
            <div key={domain} className="space-y-2">
              <h3 className="text-muted-foreground text-xs font-semibold uppercase">
                {domain}
              </h3>
              <div className="flex flex-wrap gap-2">
                {DOMAIN_STATUSES[domain].map((status) => (
                  <StatusChip key={status} domain={domain} status={status}>
                    {humanizeStatus(status)}
                  </StatusChip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Formatters — currency">
        {CURRENCY_SAMPLES.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </Section>

      <Section title="Formatters — date, percent, number">
        {OTHER_SAMPLES.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </Section>

      <Section title="UserAvatar — sizes & fallback">
        <div className="flex items-end gap-4">
          <UserAvatar name="Ada Lovelace" seed="a" size="sm" />
          <UserAvatar name="Grace Hopper" seed="b" size="default" />
          <UserAvatar name="Alan Turing" seed="c" size="lg" />
          <UserAvatar name={null} size="lg" />
        </div>
      </Section>

      <Section title="Icon buttons (tooltipped)">
        <div className="flex gap-2">
          <TooltipIconButton aria-label="Edit" tooltip="Edit">
            <Pencil className="size-4" />
          </TooltipIconButton>
          <TooltipIconButton
            aria-label="Archive"
            tooltip="Archive"
            variant="outline"
          >
            <Inbox className="size-4" />
          </TooltipIconButton>
        </div>
      </Section>

      <Section title="External link">
        <ExtLink href="https://example.com">Open documentation</ExtLink>
      </Section>

      <Section title="EmptyState">
        <EmptyState
          icon={Inbox}
          title="No deals yet"
          description="Submit your first deal to start tracking your pipeline."
          action={<Button size="sm">Submit a deal</Button>}
        />
      </Section>
    </div>
  );
}
