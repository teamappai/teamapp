"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, UserPlus, Users as UsersIcon } from "lucide-react";

import type { TeamUserRow } from "@/lib/team/users";
import { ROLE_LABELS, ROLES, type UserRole } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/format";
import {
  editUser,
  resendInvite,
  resetUserPassword,
  setUserArchived,
} from "@/app/app/users/actions";
import {
  InviteUsersDialog,
  type AssignableModule,
} from "@/components/team/invite-users-dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/shared/status-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Company roles a team_lead may assign when editing (no super_admin).
const EDITABLE_ROLES: UserRole[] = ROLES.filter((r) => r !== "super_admin");

function UserRowItem({
  row,
  onEdit,
}: {
  row: TeamUserRow;
  onEdit: (row: TeamUserRow) => void;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const isArchived = row.status === "archived";

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <UserAvatar
            name={row.fullName}
            src={row.avatarUrl}
            seed={row.id}
            size="sm"
          />
          <span>
            <span className="block font-medium">{row.fullName ?? "—"}</span>
            <span className="text-muted-foreground block text-xs">
              {row.email}
            </span>
          </span>
        </div>
      </TableCell>
      <TableCell>{ROLE_LABELS[row.role]}</TableCell>
      <TableCell>
        <StatusChip domain="user" status={row.status} />
      </TableCell>
      <TableCell suppressHydrationWarning className="text-muted-foreground">
        {row.lastActiveAt ? formatDate(row.lastActiveAt, "relative") : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {row.invitedAt ? formatDate(row.invitedAt) : "—"}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="User actions"
              disabled={pending}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.kind === "user" && (
              <DropdownMenuItem onClick={() => onEdit(row)}>
                Edit
              </DropdownMenuItem>
            )}
            {row.kind === "invitation" && row.invitationId && (
              <DropdownMenuItem
                onClick={() =>
                  run(
                    () => resendInvite(row.invitationId!),
                    "Invitation resent.",
                  )
                }
              >
                Resend invite
              </DropdownMenuItem>
            )}
            {row.kind === "user" && (
              <DropdownMenuItem
                onClick={() =>
                  run(
                    () => resetUserPassword(row.email),
                    "Password reset email sent.",
                  )
                }
              >
                Reset password
              </DropdownMenuItem>
            )}
            {row.kind === "user" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant={isArchived ? "default" : "destructive"}
                  onClick={() =>
                    run(
                      () => setUserArchived(row.id, !isArchived),
                      isArchived ? "User restored." : "User archived.",
                    )
                  }
                >
                  {isArchived ? "Restore" : "Archive"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function UsersTable({
  rows,
  onEdit,
  emptyLabel,
}: {
  rows: TeamUserRow[];
  onEdit: (row: TeamUserRow) => void;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={UsersIcon} title={emptyLabel} description="" />;
  }
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last active</TableHead>
            <TableHead>Invited</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <UserRowItem key={row.id} row={row} onEdit={onEdit} />
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function EditUserDialog({
  row,
  onOpenChange,
}: {
  row: TeamUserRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("agent");
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    if (row) {
      setFullName(row.fullName ?? "");
      setRole(row.role);
      setError(undefined);
    }
  }, [row]);

  function submit() {
    if (!row) return;
    if (!fullName.trim()) {
      setError("Enter a full name.");
      return;
    }
    start(async () => {
      const res = await editUser({
        userId: row.id,
        fullName: fullName.trim(),
        role,
      });
      if (res.ok) {
        toast.success("User updated.");
        router.refresh();
        onOpenChange(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="edit-name">Full name</Label>
            <Input
              id="edit-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
          </div>
          <div>
            <Label htmlFor="edit-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id="edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITABLE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UsersManager({
  rows,
  currentUserId,
  assignableModules,
  initialInviteOpen,
}: {
  rows: TeamUserRow[];
  currentUserId: string;
  assignableModules: AssignableModule[];
  initialInviteOpen?: boolean;
}) {
  const [inviteOpen, setInviteOpen] = React.useState(!!initialInviteOpen);
  const [editRow, setEditRow] = React.useState<TeamUserRow | null>(null);

  const active = rows.filter((r) => r.status !== "archived");
  const archived = rows.filter((r) => r.status === "archived");
  const existingEmails = React.useMemo(() => rows.map((r) => r.email), [rows]);

  // currentUserId is intentionally unused for hiding self-actions in this phase.
  void currentUserId;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="size-4" /> Invite users
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="archived">
            Archived ({archived.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <UsersTable
            rows={active}
            onEdit={setEditRow}
            emptyLabel="No active users yet"
          />
        </TabsContent>
        <TabsContent value="archived">
          <UsersTable
            rows={archived}
            onEdit={setEditRow}
            emptyLabel="No archived users"
          />
        </TabsContent>
      </Tabs>

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        existingEmails={existingEmails}
        assignableModules={assignableModules}
      />
      <EditUserDialog
        row={editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
      />
    </div>
  );
}
