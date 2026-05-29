"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Send } from "lucide-react";

import type { UserRole } from "@/lib/constants/roles";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type {
  RoleStats,
  SectionStats,
  UserProgress,
} from "@/lib/training/dashboard";
import type { ProgressStatus } from "@/lib/training/experience";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/index";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusChip } from "@/components/shared/status-chip";
import { ProgressBar } from "@/components/training/progress-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendNudge } from "@/app/app/training/progress/actions";

const DOT_CLASS: Record<ProgressStatus, string> = {
  completed: "bg-emerald-500",
  in_progress: "bg-blue-500",
  not_started: "bg-muted-foreground/30",
};

function daysSince(iso: string | null, fallback: number): number {
  if (!iso) return fallback;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

// ── Level 1: role roll-up cards ────────────────────────────────────────────────
function RoleCard({ role, onOpen }: { role: RoleStats; onOpen: () => void }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{ROLE_LABELS[role.role]}</span>
        {role.stalledCount > 0 ? (
          <StatusChip variant="warning" hideDot>
            {role.stalledCount} stalled
          </StatusChip>
        ) : null}
      </div>
      {role.userCount === 0 ? (
        <p className="text-muted-foreground text-sm">
          No active {ROLE_LABELS[role.role].toLowerCase()} members.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight">
              {role.percent}%
            </span>
            <span className="text-muted-foreground text-sm">completed</span>
          </div>
          <ProgressBar percent={role.percent} />
          <p className="text-muted-foreground text-sm">
            {role.startedUsers} of {role.userCount} started
          </p>
        </>
      )}
      <Button
        variant="outline"
        size="sm"
        className="mt-auto w-fit"
        onClick={onOpen}
        disabled={role.userCount === 0}
      >
        View breakdown <ChevronRight className="size-4" />
      </Button>
    </Card>
  );
}

// ── Level 2: per-section breakdown table ───────────────────────────────────────
function SectionTable({
  role,
  onOpenSection,
}: {
  role: RoleStats;
  onOpenSection: (sectionId: string) => void;
}) {
  if (role.sections.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
        No training is assigned to {ROLE_LABELS[role.role].toLowerCase()} yet.
      </p>
    );
  }
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Section</TableHead>
            <TableHead className="text-right">Assigned</TableHead>
            <TableHead className="text-right">Started</TableHead>
            <TableHead className="text-right">Completed</TableHead>
            <TableHead className="text-right">Stalled</TableHead>
            <TableHead className="text-right">Completion</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {role.sections.map((s) => (
            <TableRow
              key={s.sectionId}
              className="cursor-pointer"
              onClick={() => onOpenSection(s.sectionId)}
            >
              <TableCell className="font-medium">{s.sectionTitle}</TableCell>
              <TableCell className="text-right">{s.totalAssigned}</TableCell>
              <TableCell className="text-right">{s.startedCount}</TableCell>
              <TableCell className="text-right">{s.completedCount}</TableCell>
              <TableCell className="text-right">
                {s.stalledCount > 0 ? (
                  <span className="font-medium text-amber-600 dark:text-amber-400">
                    {s.stalledCount}
                  </span>
                ) : (
                  s.stalledCount
                )}
              </TableCell>
              <TableCell className="text-right">{s.percent}%</TableCell>
              <TableCell className="w-8">
                <ChevronRight className="text-muted-foreground size-4" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Level 3: per-user view with module dots + nudge ────────────────────────────
function UserList({
  section,
  stallDays,
}: {
  section: SectionStats;
  stallDays: number;
}) {
  const [nudgeUser, setNudgeUser] = React.useState<UserProgress | null>(null);

  if (section.users.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
        No active members in this role.
      </p>
    );
  }

  return (
    <>
      <div className="divide-y rounded-lg border">
        {section.users.map((u) => {
          const stalled = section.modules.some((m) => u.cells[m.id]?.stalled);
          return (
            <div
              key={u.userId}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {u.fullName ?? u.email}
                </div>
                <div className="text-muted-foreground text-xs">
                  {u.lastActivityAt
                    ? `Last active ${formatDate(u.lastActivityAt, "relative")}`
                    : "No activity yet"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {section.modules.map((m) => {
                  const cell = u.cells[m.id];
                  const status = cell?.status ?? "not_started";
                  return (
                    <span
                      key={m.id}
                      title={`${m.title}: ${status.replace("_", " ")}${
                        cell?.stalled ? " (stalled)" : ""
                      }`}
                      className={cn(
                        "size-3 rounded-full",
                        DOT_CLASS[status],
                        cell?.stalled &&
                          "ring-offset-background ring-2 ring-amber-400 ring-offset-1",
                      )}
                    />
                  );
                })}
              </div>
              {stalled ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNudgeUser(u)}
                >
                  <Send className="size-3.5" /> Send nudge
                </Button>
              ) : (
                <span className="text-muted-foreground w-[88px] text-right text-xs">
                  On track
                </span>
              )}
            </div>
          );
        })}
      </div>

      <NudgeDialog
        user={nudgeUser}
        section={section}
        stallDays={stallDays}
        onClose={() => setNudgeUser(null)}
      />
    </>
  );
}

function NudgeDialog({
  user,
  section,
  stallDays,
  onClose,
}: {
  user: UserProgress | null;
  section: SectionStats;
  stallDays: number;
  onClose: () => void;
}) {
  const [message, setMessage] = React.useState("");
  const [pending, start] = React.useTransition();

  const days = user ? daysSince(user.lastActivityAt, stallDays) : stallDays;
  const name = user?.fullName?.trim().split(/\s+/)[0] ?? "there";

  React.useEffect(() => {
    if (user) {
      setMessage(
        `Hi ${name}, just a quick check — you haven't continued your ${section.sectionTitle} training in ${days} days. Anything I can help with?`,
      );
    }
  }, [user, name, section.sectionTitle, days]);

  function submit() {
    if (!user) return;
    start(async () => {
      const res = await sendNudge({
        userId: user.userId,
        sectionId: section.sectionId,
        daysInactive: days,
        message,
      });
      if (res.ok) {
        toast.success(`Nudge sent to ${user.fullName ?? user.email}.`);
        onClose();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a nudge</DialogTitle>
          <DialogDescription>
            A friendly in-app reminder to {user?.fullName ?? user?.email}. You
            can edit the message before sending.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          aria-label="Nudge message"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !message.trim()}>
            <Send className="size-4" /> Send nudge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── orchestrator ───────────────────────────────────────────────────────────────
export function ProgressDashboard({
  roles,
  stallDays,
}: {
  roles: RoleStats[];
  stallDays: number;
}) {
  const [activeRole, setActiveRole] = React.useState<UserRole | null>(null);
  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(
    null,
  );

  const role = roles.find((r) => r.role === activeRole) ?? null;
  const section = role?.sections.find((s) => s.sectionId === activeSectionId);

  // Level 3
  if (role && section) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setActiveSectionId(null)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="size-4" /> {ROLE_LABELS[role.role]}
          </button>
          <ChevronRight className="text-muted-foreground size-3.5" />
          <span className="font-medium">{section.sectionTitle}</span>
        </div>
        <UserList section={section} stallDays={stallDays} />
      </div>
    );
  }

  // Level 2
  if (role) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveRole(null)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="size-4" /> All roles
          </button>
          <Select
            value={role.role}
            onValueChange={(v) => {
              setActiveRole(v as UserRole);
              setActiveSectionId(null);
            }}
          >
            <SelectTrigger className="w-48" aria-label="Select role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.role} value={r.role}>
                  {ROLE_LABELS[r.role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SectionTable role={role} onOpenSection={setActiveSectionId} />
      </div>
    );
  }

  // Level 1
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {roles.map((r) => (
        <RoleCard
          key={r.role}
          role={r}
          onOpen={() => {
            setActiveRole(r.role);
            setActiveSectionId(null);
          }}
        />
      ))}
    </div>
  );
}
