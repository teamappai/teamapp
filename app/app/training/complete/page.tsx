import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PartyPopper } from "lucide-react";

import { getSessionProfile } from "@/lib/auth/profile";
import { getTrainingExperience } from "@/lib/training/experience";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/training/progress-bar";

export const metadata: Metadata = { title: "Training complete · TeamApp" };

export default async function TrainingCompletePage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const { profile } = session;
  const { summary } = await getTrainingExperience(
    profile.role,
    profile.company_id,
    profile.id,
  );

  const allDone = summary.total > 0 && summary.completed >= summary.total;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <PartyPopper className="size-8" aria-hidden />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {allDone ? "You finished your training!" : "Nice work!"}
        </h1>
        <p className="text-muted-foreground max-w-md">
          {allDone
            ? "You've completed every module assigned to your role. We'll let you know when new training is added."
            : `You're at ${summary.completed} of ${summary.total} modules (${summary.percent}%). Keep going — you're almost there.`}
        </p>
      </div>
      <ProgressBar percent={summary.percent} className="max-w-xs" />
      <Button asChild>
        <Link href="/app/training">Back to training</Link>
      </Button>
    </div>
  );
}
