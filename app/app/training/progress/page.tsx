import type { Metadata } from "next";
import { TriangleAlert, Users } from "lucide-react";

import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { getTrainingDashboard, STALL_DAYS } from "@/lib/training/dashboard";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProgressDashboard } from "@/components/training/progress-dashboard";

export const metadata: Metadata = { title: "Training Progress · TeamApp" };

const DESCRIPTION =
  "See how your team is progressing through training, spot stalled learners, and send a nudge.";

export default async function TrainingProgressPage() {
  const { companyId } = await requireTeamLead();

  // super_admin has no company — the dashboard is company-scoped.
  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Training Progress" description={DESCRIPTION} />
        <EmptyState
          icon={Users}
          title="Company-scoped"
          description="Training progress is reported per team. Switch to a company (or impersonate a team lead) to view it."
        />
      </div>
    );
  }

  const dashboard = await getTrainingDashboard(companyId);

  return (
    <div className="space-y-6">
      <PageHeader title="Training Progress" description={DESCRIPTION} />

      {dashboard.alerts.length > 0 ? (
        <div className="space-y-2">
          {dashboard.alerts.map((a, i) => (
            <div
              key={`${a.role}-${i}`}
              className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {a.stalledCount} {ROLE_LABELS[a.role].toLowerCase()} learners
                haven&apos;t touched {a.sectionTitle} in {STALL_DAYS}+ days —
                review.
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <ProgressDashboard roles={dashboard.roles} stallDays={STALL_DAYS} />
    </div>
  );
}
