"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  recordModuleView,
  markModuleComplete,
} from "@/app/app/training/actions";

type Props = {
  moduleId: string;
  prevId: string | null;
  nextId: string | null;
  index: number;
  total: number;
  isCompleted: boolean;
  /** False for team leads (manage, don't track) and in preview mode. */
  canComplete: boolean;
  preview: boolean;
};

export function ModuleFooterNav({
  moduleId,
  prevId,
  nextId,
  index,
  total,
  isCompleted,
  canComplete,
  preview,
}: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  // Record the view once on mount (engagement). Never in preview mode.
  React.useEffect(() => {
    if (preview) return;
    void recordModuleView(moduleId);
  }, [moduleId, preview]);

  // Preview tabs hide the sticky action bar entirely (PA preview).
  if (preview) return null;

  function goNext() {
    if (nextId) router.push(`/app/training/${nextId}`);
    else router.push("/app/training/complete");
  }

  function complete() {
    start(async () => {
      const res = await markModuleComplete(moduleId);
      if (!res.ok) {
        toast.error(res.error ?? "Couldn't save your progress.");
        return;
      }
      toast.success("Module complete! 1 step closer.");
      goNext();
    });
  }

  return (
    <div className="bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur sm:left-[var(--sidebar-width,0)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          disabled={!prevId || pending}
          onClick={() => prevId && router.push(`/app/training/${prevId}`)}
        >
          <ArrowLeft className="size-4" /> Previous
        </Button>

        <span className="text-muted-foreground text-xs font-medium">
          Module {index} of {total}
        </span>

        {canComplete ? (
          <Button size="sm" onClick={complete} disabled={pending}>
            <Check className="size-4" />
            {nextId ? "Mark complete & next" : "Mark complete & finish"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant={isCompleted ? "outline" : "default"}
            onClick={goNext}
            disabled={pending}
          >
            {nextId ? "Next module" : "Finish"}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
