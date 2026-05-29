"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";

import type { DealType, DealStage, RequestType } from "@/lib/team/config";
import { ROLE_LABELS, type UserRole } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/format";
import {
  saveDealType,
  removeDealType,
  saveDealStage,
  removeDealStage,
  customizeDealStages,
  saveRequestType,
  removeRequestType,
  reorderConfigAction,
} from "@/app/app/management/actions";
import { SortableTable, SortableRow, DragHandle } from "@/components/team/dnd";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusChip } from "@/components/shared/status-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { Tag } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

// Roles a request type can default-route to (PA-4 smart routing).
const ASSIGNEE_ROLES: UserRole[] = ["agent", "admin_tc", "marketing"];
const UNASSIGNED = "__none__";

function useRunner() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    ok: string,
    after?: () => void,
  ) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(ok);
        router.refresh();
        after?.();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }
  return { pending, run };
}

function RowMenu({
  onEdit,
  onDelete,
  disabled,
}: {
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Actions"
          disabled={disabled}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Deal Types ────────────────────────────────────────────────────────────────
export function DealTypesTab({ dealTypes }: { dealTypes: DealType[] }) {
  const { pending, run } = useRunner();
  const [items, setItems] = React.useState(dealTypes);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DealType | null>(null);
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string>();

  React.useEffect(() => setItems(dealTypes), [dealTypes]);

  function reorder(ids: string[]) {
    const byId = new Map(items.map((i) => [i.id, i]));
    setItems(ids.map((id) => byId.get(id)!));
    run(() => reorderConfigAction("deal_types", ids), "Order saved.");
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setError(undefined);
    setDialogOpen(true);
  }
  function openEdit(t: DealType) {
    setEditing(t);
    setName(t.name);
    setError(undefined);
    setDialogOpen(true);
  }
  function submit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    run(
      () => saveDealType({ id: editing?.id, name: name.trim() }),
      editing ? "Deal type updated." : "Deal type added.",
      () => setDialogOpen(false),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Add new
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No deal types yet"
          description="Add the deal types your team uses."
        />
      ) : (
        <SortableTable
          id="deal-types-dnd"
          ids={items.map((i) => i.id)}
          onReorder={reorder}
        >
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => (
                  <SortableRow key={t.id} id={t.id}>
                    <TableCell className="w-8">
                      <DragHandle label={`Reorder ${t.name}`} />
                    </TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(t.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowMenu
                        disabled={pending}
                        onEdit={() => openEdit(t)}
                        onDelete={() =>
                          run(() => removeDealType(t.id), "Deal type deleted.")
                        }
                      />
                    </TableCell>
                  </SortableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </SortableTable>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit deal type" : "Add deal type"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="dt-name">Name</Label>
              <Input
                id="dt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Buyer-Side"
              />
              {error && (
                <p className="text-destructive mt-1 text-xs">{error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={pending}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Deal Stages ─────────────────────────────────────────────────────────────--
export function DealStagesTab({
  dealStages,
  companyId,
}: {
  dealStages: DealStage[];
  companyId: string;
}) {
  const { pending, run } = useRunner();
  const [items, setItems] = React.useState(dealStages);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DealStage | null>(null);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#3b82f6");
  const [won, setWon] = React.useState(false);
  const [lost, setLost] = React.useState(false);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => setItems(dealStages), [dealStages]);

  // Are we looking at global defaults (not yet customized for this company)?
  const usingGlobals = items.length > 0 && items[0].company_id !== companyId;

  function reorder(ids: string[]) {
    const byId = new Map(items.map((i) => [i.id, i]));
    setItems(ids.map((id) => byId.get(id)!));
    run(() => reorderConfigAction("deal_stages", ids), "Order saved.");
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setColor("#3b82f6");
    setWon(false);
    setLost(false);
    setError(undefined);
    setDialogOpen(true);
  }
  function openEdit(s: DealStage) {
    setEditing(s);
    setName(s.name);
    setColor(s.color ?? "#3b82f6");
    setWon(s.is_terminal_won);
    setLost(s.is_terminal_lost);
    setError(undefined);
    setDialogOpen(true);
  }
  function submit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (won && lost) {
      setError("A stage can't be both won and lost.");
      return;
    }
    run(
      () =>
        saveDealStage({
          id: editing?.id,
          name: name.trim(),
          color,
          isTerminalWon: won,
          isTerminalLost: lost,
        }),
      editing ? "Stage updated." : "Stage added.",
      () => setDialogOpen(false),
    );
  }

  if (usingGlobals) {
    return (
      <div className="space-y-3">
        <Card className="p-4">
          <p className="text-muted-foreground mb-3 text-sm">
            You&apos;re using the default pipeline stages. Customize them to
            rename, recolor, reorder, or add your own.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            {items.map((s) => (
              <StatusChip key={s.id} variant="neutral" hideDot>
                {s.name}
              </StatusChip>
            ))}
          </div>
          <Button
            disabled={pending}
            onClick={() =>
              run(() => customizeDealStages(), "Stages ready to customize.")
            }
          >
            Customize stages
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Add new
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No stages yet"
          description="Add your pipeline stages."
        />
      ) : (
        <SortableTable
          id="deal-stages-dnd"
          ids={items.map((i) => i.id)}
          onReorder={reorder}
        >
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Terminal</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((s) => (
                  <SortableRow key={s.id} id={s.id}>
                    <TableCell className="w-8">
                      <DragHandle label={`Reorder ${s.name}`} />
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-4 rounded-full border"
                          style={{ background: s.color ?? "transparent" }}
                        />
                        <span className="text-muted-foreground text-xs">
                          {s.color ?? "—"}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.is_terminal_won && (
                        <StatusChip variant="success" hideDot>
                          Won
                        </StatusChip>
                      )}
                      {s.is_terminal_lost && (
                        <StatusChip variant="danger" hideDot>
                          Lost
                        </StatusChip>
                      )}
                      {!s.is_terminal_won && !s.is_terminal_lost && (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowMenu
                        disabled={pending}
                        onEdit={() => openEdit(s)}
                        onDelete={() =>
                          run(() => removeDealStage(s.id), "Stage deleted.")
                        }
                      />
                    </TableCell>
                  </SortableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </SortableTable>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit stage" : "Add stage"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="ds-name">Name</Label>
              <Input
                id="ds-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Under Contract"
              />
            </div>
            <div>
              <Label htmlFor="ds-color">Color</Label>
              <input
                id="ds-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-16 cursor-pointer rounded border"
              />
            </div>
            <div className="flex gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={won}
                  onCheckedChange={(c) => {
                    setWon(c === true);
                    if (c === true) setLost(false);
                  }}
                />
                Terminal — Won
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={lost}
                  onCheckedChange={(c) => {
                    setLost(c === true);
                    if (c === true) setWon(false);
                  }}
                />
                Terminal — Lost
              </label>
            </div>
            {error && <p className="text-destructive text-xs">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={pending}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Request Types ───────────────────────────────────────────────────────────--
export function RequestTypesTab({
  requestTypes,
}: {
  requestTypes: RequestType[];
}) {
  const { pending, run } = useRunner();
  const [items, setItems] = React.useState(requestTypes);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RequestType | null>(null);
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<string>(UNASSIGNED);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => setItems(requestTypes), [requestTypes]);

  function reorder(ids: string[]) {
    const byId = new Map(items.map((i) => [i.id, i]));
    setItems(ids.map((id) => byId.get(id)!));
    run(() => reorderConfigAction("request_types", ids), "Order saved.");
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setRole(UNASSIGNED);
    setError(undefined);
    setDialogOpen(true);
  }
  function openEdit(t: RequestType) {
    setEditing(t);
    setName(t.name);
    setRole(t.default_assignee_role ?? UNASSIGNED);
    setError(undefined);
    setDialogOpen(true);
  }
  function submit() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    run(
      () =>
        saveRequestType({
          id: editing?.id,
          name: name.trim(),
          defaultAssigneeRole: role === UNASSIGNED ? null : (role as UserRole),
        }),
      editing ? "Request type updated." : "Request type added.",
      () => setDialogOpen(false),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Add new
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No request types yet"
          description="Add the request types your team uses."
        />
      ) : (
        <SortableTable
          id="request-types-dnd"
          ids={items.map((i) => i.id)}
          onReorder={reorder}
        >
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>Default assignee</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => (
                  <SortableRow key={t.id} id={t.id}>
                    <TableCell className="w-8">
                      <DragHandle label={`Reorder ${t.name}`} />
                    </TableCell>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.default_assignee_role
                        ? ROLE_LABELS[t.default_assignee_role]
                        : "Unassigned"}
                    </TableCell>
                    <TableCell className="text-right">
                      <RowMenu
                        disabled={pending}
                        onEdit={() => openEdit(t)}
                        onDelete={() =>
                          run(
                            () => removeRequestType(t.id),
                            "Request type deleted.",
                          )
                        }
                      />
                    </TableCell>
                  </SortableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </SortableTable>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit request type" : "Add request type"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="rt-name">Name</Label>
              <Input
                id="rt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Flyer Design"
              />
            </div>
            <div>
              <Label htmlFor="rt-role">Default assignee role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="rt-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {ASSIGNEE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && <p className="text-destructive text-xs">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={pending}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
