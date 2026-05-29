import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import { getTrainingExperience } from "@/lib/training/experience";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { GraduationCap, LineChart } from "lucide-react";
import {
  TrainingExperience,
  type ExperienceSectionView,
} from "@/components/training/training-experience";

export const metadata: Metadata = { title: "Training · TeamApp" };

export default async function TrainingPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const { profile } = session;
  const experience = await getTrainingExperience(
    profile.role,
    profile.company_id,
    profile.id,
  );

  const { completed, total, percent } = experience.summary;
  const isManager =
    profile.role === "team_lead" || profile.role === "super_admin";

  const sections: ExperienceSectionView[] = experience.sections.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    visibleToRoles: s.visible_to_roles,
    completedCount: s.completedCount,
    createdAt: s.created_at,
    modules: s.modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      estimatedMinutes: m.estimated_minutes,
      progressStatus: m.progressStatus,
      position: m.position,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training"
        description={
          total === 0
            ? "Your training will appear here once it's assigned."
            : `${completed} of ${total} modules complete (${percent}%)`
        }
        action={
          isManager ? (
            <Button asChild variant="outline">
              <Link href="/app/training/progress">
                <LineChart className="size-4" /> Team progress
              </Link>
            </Button>
          ) : undefined
        }
      />

      {sections.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No training yet"
          description="There's no published training assigned to your role right now. Check back soon."
        />
      ) : (
        <TrainingExperience sections={sections} total={total} />
      )}
    </div>
  );
}
