import Link from "next/link";
import type { Metadata } from "next";

import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { getCompany } from "@/lib/billing/state";
import { planRank, type PlanId } from "@/lib/billing/plans";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CancelFlow } from "./cancel-flow";

export const metadata: Metadata = { title: "Cancel subscription | TeamApp" };

export default async function CancelPage() {
  const ctx = await requireTeamLead();
  if (!ctx.companyId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cancel subscription
        </h1>
        <Card>
          <CardContent className="py-8 text-center">
            <Button asChild variant="outline">
              <Link href="/app/admin/companies">Go to Companies</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const company = await getCompany(ctx.companyId);
  const planId = (company?.plan ?? "launch") as PlanId;
  const canDowngrade =
    planRank(planId) > planRank("launch") && planId !== "enterprise";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          We&rsquo;re sorry to see you go
        </h1>
        <p className="text-muted-foreground text-sm">
          Before you cancel, here are a few options that might work better.
        </p>
      </div>
      <CancelFlow canDowngrade={canDowngrade} />
    </div>
  );
}
