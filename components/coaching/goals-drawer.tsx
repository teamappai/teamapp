"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import type { GoalProgress } from "@/lib/coaching/queries";
import {
  GOAL_TYPES,
  goalDef,
  type GoalCategory,
  type GoalPeriod,
  type GoalType,
} from "@/lib/coaching/goals";
import { upsertGoal, deleteGoal } from "@/app/app/coaching/actions";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoalProgressBar } from "@/components/coaching/goal-progress-bar";

function defaultPeriodStart(period: GoalPeriod): string {
  const d = new Date();
  const y = d.getFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  if (period === "monthly") return `${y}-${pad(d.getMonth() + 1)}-01`;
  if (period === "quarterly")
    return `${y}-${pad(Math.floor(d.getMonth() / 3) * 3 + 1)}-01`;
  return `${y}-01-01`;
}

type Editing = {
  id?: string;
  goalType: GoalType;
  period: GoalPeriod;
  periodStart: string;
  targetInput: string;
};

function blankEditing(defaultCategory: GoalCategory): Editing {
  const firstOfCategory =
    GOAL_TYPES.find((g) => g.category === defaultCategory) ?? GOAL_TYPES[0];
  return {
    goalType: firstOfCategory.type,
    period: "quarterly",
    periodStart: defaultPeriodStart("quarterly"),
    targetInput: "",
  };
}

/**
 * Set/edit goals for an agent (or the team). Reused by the team_lead leaderboard
 * drawer (defaultCategory = input) and the agent's own Goals section
 * (defaultCategory = outcome). Either party may edit any goal in scope (PA-6).
 */
export function GoalsDrawer({
  open,
  onOpenChange,
  agentName,
  userId,
  goals,
  defaultCategory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name for the header; null/empty = team-wide. */
  agentName: string | null;
  /** Goal owner: a user id, or null for a team-wide goal. */
  userId: string | null;
  goals: GoalProgress[];
  defaultCategory: GoalCategory;
}) {
  const [editing, setEditing] = React.useState<Editing>(() =>
    blankEditing(defaultCategory),
  );
  const [showForm, setShowForm] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const def = goalDef(editing.goalType);
  const isCurrency = def.format === "currency";

  function startNew() {
    setEditing(blankEditing(defaultCategory));
    setShowForm(true);
  }
  function startEdit(g: GoalProgress) {
    setEditing({
      id: g.id,
      goalType: g.goalType,
      period: g.period,
      periodStart: g.periodStart,
      targetInput: isCurrencyType(g.goalType)
        ? String(g.target / 100)
        : String(g.target),
    });
    setShowForm(true);
  }

  function isCurrencyType(t: GoalType) {
    return goalDef(t).format === "currency";
  }

  function onSave() {
    const raw = Number(editing.targetInput);
    if (!Number.isFinite(raw) || raw < 0) {
      toast.error("Enter a valid target.");
      return;
    }
    const targetValue = isCurrency ? Math.round(raw * 100) : Math.round(raw);
    startTransition(async () => {
      const res = await upsertGoal({
        id: editing.id,
        userId,
        goalType: editing.goalType,
        period: editing.period,
        periodStart: editing.periodStart,
        targetValue,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Goal saved");
      setShowForm(false);
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteGoal(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Goal removed");
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {agentName ? `${agentName}'s goals` : "Team goals"}
          </SheetTitle>
          <SheetDescription>
            Track outcome and activity targets for the period. Either you or the
            agent can edit these.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {goals.length === 0 ? (
            <p className="text-muted-foreground text-sm">No goals set yet.</p>
          ) : (
            <div className="space-y-4">
              {goals.map((g) => (
                <div key={g.id} className="space-y-1">
                  <GoalProgressBar goal={g} />
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(g)}
                    >
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(g.id)}
                      disabled={pending}
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showForm ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label>Goal type</Label>
                <Select
                  value={editing.goalType}
                  onValueChange={(v) =>
                    setEditing((e) => ({ ...e, goalType: v as GoalType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map((g) => (
                      <SelectItem key={g.type} value={g.type}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Period</Label>
                  <Select
                    value={editing.period}
                    onValueChange={(v) =>
                      setEditing((e) => ({
                        ...e,
                        period: v as GoalPeriod,
                        periodStart: e.id
                          ? e.periodStart
                          : defaultPeriodStart(v as GoalPeriod),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="period-start">Starts</Label>
                  <Input
                    id="period-start"
                    type="date"
                    value={editing.periodStart}
                    onChange={(e) =>
                      setEditing((s) => ({ ...s, periodStart: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="target">
                  Target {isCurrency ? "($)" : "(count)"}
                </Label>
                <Input
                  id="target"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={editing.targetInput}
                  onChange={(e) =>
                    setEditing((s) => ({ ...s, targetInput: e.target.value }))
                  }
                  placeholder={isCurrency ? "200000" : "200"}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={onSave} disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save goal
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={startNew}>
              <Plus className="size-4" />
              {defaultCategory === "outcome" ? "Add outcome goal" : "Add goal"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
