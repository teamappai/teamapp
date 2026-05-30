"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Check,
  Download,
  FileText,
  Hand,
  Loader2,
  MoreHorizontal,
  Trash2,
  Upload,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { uploadRequestFile } from "@/lib/storage";
import {
  addRequestComment,
  changeRequestStatus,
  claimRequest,
  deleteRequestFile,
  recordRequestFile,
  softDeleteRequest,
  updateRequestFields,
} from "@/app/app/requests/actions";
import { ROLE_LABELS, type UserRole } from "@/lib/constants/roles";
import { formatBytes, formatDate } from "@/lib/utils/format";
import {
  categoryLabel,
  MAX_REQUEST_FILE_MB,
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_VARIANT,
  REQUEST_FILE_ACCEPT,
  STATUS_FLOW,
  STATUS_LABELS,
  type RequestPriority,
  type RequestStatus,
} from "@/lib/requests/format";
import { cn } from "@/lib/utils/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
};
type CommentItem = {
  id: string;
  body: string;
  authorName: string | null;
  authorAvatar: string | null;
  authorRole: UserRole | null;
  authorId: string | null;
  createdAt: string;
};
type FileItem = {
  id: string;
  name: string;
  sizeBytes: number | null;
  uploadedAt: string;
  uploaderName: string | null;
  uploadedByMe: boolean;
  url: string | null;
};
type StatusChangeItem = {
  id: string;
  from: string | null;
  to: string;
  changerName: string | null;
  createdAt: string;
};
type RequestData = {
  id: string;
  title: string;
  description: string | null;
  status: RequestStatus;
  priority: RequestPriority;
  typeName: string;
  category: string;
  dueDate: string | null;
  createdAt: string;
  creatorName: string | null;
  creatorId: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  assignedToRole: UserRole | null;
  relatedDealId: string | null;
  relatedDealLabel: string | null;
};

type Props = {
  request: RequestData;
  comments: CommentItem[];
  files: FileItem[];
  statusChanges: StatusChangeItem[];
  members: Member[];
  currentUserId: string;
  currentUserCompanyId: string;
  canEdit: boolean;
  canManage: boolean;
  canDelete: boolean;
  canClaim: boolean;
};

export function RequestDetail(props: Props) {
  const { request, canEdit, canDelete, canClaim } = props;
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const onChangeStatus = async (to: RequestStatus) => {
    if (to === request.status) return;
    setBusy(true);
    const res = await changeRequestStatus(request.id, { to });
    setBusy(false);
    if (res.ok) {
      toast.success(`Moved to ${STATUS_LABELS[to]}.`);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const onClaim = async () => {
    setBusy(true);
    const res = await claimRequest(request.id);
    setBusy(false);
    if (res.ok) {
      toast.success("You claimed this request.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip variant="neutral" hideDot>
              {request.typeName}
            </StatusChip>
            <StatusChip variant="neutral" hideDot>
              {categoryLabel(request.category)}
            </StatusChip>
            <StatusChip domain="request" status={request.status} />
            {request.priority === "high" || request.priority === "urgent" ? (
              <StatusChip variant={PRIORITY_VARIANT[request.priority]} hideDot>
                {PRIORITY_LABELS[request.priority]}
              </StatusChip>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {request.title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Request actions"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete request
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      {/* Kanban status changer (F-127/F-141) */}
      <KanbanStatus
        status={request.status}
        busy={busy}
        onChange={onChangeStatus}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT — description + comments */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-2 py-4">
              <h2 className="text-sm font-semibold">Description</h2>
              {request.description ? (
                <p className="text-sm whitespace-pre-wrap">
                  {request.description}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No description provided.
                </p>
              )}
            </CardContent>
          </Card>

          <Comments requestId={request.id} comments={props.comments} />
        </div>

        {/* RIGHT — status / assignee / meta / attachments */}
        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3 py-4 text-sm">
              <Meta label="Status">
                <StatusChip domain="request" status={request.status} />
              </Meta>
              {props.statusChanges[0] ? (
                <p className="text-muted-foreground text-xs">
                  Last changed{" "}
                  {formatDate(props.statusChanges[0].createdAt, "short")}
                  {props.statusChanges[0].changerName
                    ? ` by ${props.statusChanges[0].changerName}`
                    : ""}
                </p>
              ) : null}

              <Meta label="Assignee">
                {request.assigneeId ? (
                  <span className="flex items-center gap-2">
                    <UserAvatar
                      size="sm"
                      name={request.assigneeName}
                      seed={request.assigneeId}
                      src={request.assigneeAvatar}
                    />
                    {request.assigneeName ?? "Unnamed"}
                  </span>
                ) : request.assignedToRole ? (
                  <span className="text-muted-foreground">
                    {ROLE_LABELS[request.assignedToRole]} queue (unclaimed)
                  </span>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </Meta>
              {canClaim ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={onClaim}
                  disabled={busy}
                >
                  <Hand className="size-4" />
                  Claim this request
                </Button>
              ) : null}

              <Meta label="Due date">
                {request.dueDate ? (
                  formatDate(request.dueDate, "short")
                ) : (
                  <span className="text-muted-foreground">Best effort</span>
                )}
              </Meta>
              <Meta label="Created by">{request.creatorName ?? "Someone"}</Meta>
              <Meta label="Created">
                {formatDate(request.createdAt, "short")}
              </Meta>
              {request.relatedDealId ? (
                <Meta label="Related deal">
                  <Link
                    href={`/app/deals/${request.relatedDealId}`}
                    className="text-primary hover:underline"
                  >
                    {request.relatedDealLabel ?? "View deal"}
                  </Link>
                </Meta>
              ) : null}
            </CardContent>
          </Card>

          <Attachments
            requestId={request.id}
            companyId={props.currentUserCompanyId}
            files={props.files}
            canManage={props.canManage}
          />
        </div>
      </div>

      <EditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        request={request}
        members={props.members}
      />
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        requestId={request.id}
      />
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

// ── Kanban status row ─────────────────────────────────────────────────────────
function KanbanStatus({
  status,
  busy,
  onChange,
}: {
  status: RequestStatus;
  busy: boolean;
  onChange: (to: RequestStatus) => void;
}) {
  const currentIndex = STATUS_FLOW.indexOf(status);
  const rejected = status === "rejected";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {STATUS_FLOW.map((s, i) => {
          const state = rejected
            ? "future"
            : i < currentIndex
              ? "past"
              : i === currentIndex
                ? "current"
                : "future";
          return (
            <button
              key={s}
              type="button"
              disabled={busy || state === "current"}
              onClick={() => onChange(s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                state === "current" &&
                  "bg-primary text-primary-foreground font-medium",
                state === "past" &&
                  "bg-muted text-muted-foreground hover:bg-muted/70",
                state === "future" &&
                  "hover:bg-accent text-foreground/70 border",
              )}
            >
              {state === "past" ? <Check className="size-3.5" /> : null}
              {STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>

      {rejected ? <StatusChip domain="request" status="rejected" /> : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More status options">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {rejected ? (
            <DropdownMenuItem onSelect={() => onChange("pending")}>
              Reopen (set Pending)
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onChange("rejected")}
            >
              Reject request
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ── Comments (transparency by default — no internal notes) ────────────────────
function Comments({
  requestId,
  comments,
}: {
  requestId: string;
  comments: CommentItem[];
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [newestFirst, setNewestFirst] = React.useState(true);

  const ordered = React.useMemo(() => {
    const sorted = [...comments].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return newestFirst ? sorted.reverse() : sorted;
  }, [comments, newestFirst]);

  const post = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const res = await addRequestComment(requestId, { body });
    setBusy(false);
    if (res.ok) {
      setBody("");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Comments ({comments.length})
          </h2>
          <button
            type="button"
            onClick={() => setNewestFirst((v) => !v)}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            <ArrowUpDown className="size-3.5" />
            {newestFirst ? "Newest first" : "Oldest first"}
          </button>
        </div>

        {ordered.length === 0 ? (
          <p className="text-muted-foreground text-sm">No comments yet.</p>
        ) : (
          <ul className="space-y-4">
            {ordered.map((c) => (
              <li key={c.id} className="flex gap-3">
                <UserAvatar
                  size="sm"
                  name={c.authorName}
                  src={c.authorAvatar}
                  seed={c.authorId}
                />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">
                      {c.authorName ?? "Someone"}
                    </span>
                    {c.authorRole ? (
                      <StatusChip variant="neutral" hideDot>
                        {ROLE_LABELS[c.authorRole]}
                      </StatusChip>
                    ) : null}
                    <span className="text-muted-foreground text-xs">
                      {formatDate(c.createdAt, "short")}
                    </span>
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2 border-t pt-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment"
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={post} disabled={busy || !body.trim()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Comment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Attachments ───────────────────────────────────────────────────────────────
function Attachments({
  requestId,
  companyId,
  files,
  canManage,
}: {
  requestId: string;
  companyId: string;
  files: FileItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const onUpload = async (list: FileList) => {
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > MAX_REQUEST_FILE_MB * 1024 * 1024);
    if (tooBig) {
      toast.error(`Each file must be under ${MAX_REQUEST_FILE_MB}MB.`);
      return;
    }
    setBusy(true);
    try {
      for (const file of arr) {
        const { path } = await uploadRequestFile(supabase, {
          companyId,
          requestId,
          filename: file.name,
          file,
        });
        const res = await recordRequestFile(requestId, {
          storagePath: path,
          originalFilename: file.name,
          fileSizeBytes: file.size,
          contentType: file.type || null,
        });
        if (!res.ok) toast.error(res.error);
      }
      toast.success(
        `Uploaded ${arr.length} file${arr.length === 1 ? "" : "s"}.`,
      );
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    const res = await deleteRequestFile(id);
    if (res.ok) {
      toast.success("File deleted.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Attachments ({files.length})
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Upload
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={REQUEST_FILE_ACCEPT}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length === 0 ? (
          <p className="text-muted-foreground text-sm">No attachments.</p>
        ) : (
          <ul className="divide-y">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 py-2">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {f.sizeBytes ? `${formatBytes(f.sizeBytes)} · ` : ""}
                    {formatDate(f.uploadedAt, "short")}
                  </p>
                </div>
                {f.url ? (
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    aria-label="Download"
                  >
                    <a href={f.url} target="_blank" rel="noreferrer" download>
                      <Download className="size-4" />
                    </a>
                  </Button>
                ) : null}
                {canManage || f.uploadedByMe ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${f.name}`}
                    onClick={() => onDelete(f.id, f.name)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────
function EditDialog({
  open,
  onOpenChange,
  request,
  members,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: RequestData;
  members: Member[];
}) {
  const router = useRouter();
  const [title, setTitle] = React.useState(request.title);
  const [description, setDescription] = React.useState(
    request.description ?? "",
  );
  const [priority, setPriority] = React.useState<RequestPriority>(
    request.priority,
  );
  const [dueDate, setDueDate] = React.useState(request.dueDate ?? "");
  const initialAssignee = request.assigneeId
    ? `user:${request.assigneeId}`
    : request.assignedToRole
      ? `role:${request.assignedToRole}`
      : "";
  const [assignee, setAssignee] = React.useState(initialAssignee);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(request.title);
      setDescription(request.description ?? "");
      setPriority(request.priority);
      setDueDate(request.dueDate ?? "");
      setAssignee(initialAssignee);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSave = async () => {
    if (title.trim().length < 3) {
      toast.error("Title must be at least 3 characters.");
      return;
    }
    const assignedToUserId = assignee.startsWith("user:")
      ? assignee.slice(5)
      : null;
    const assignedToRole = assignee.startsWith("role:")
      ? (assignee.slice(5) as UserRole)
      : null;
    setBusy(true);
    const res = await updateRequestFields(request.id, {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      dueDate: dueDate || null,
      assignedToUserId,
      assignedToRole,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Request updated.");
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Description</Label>
            <Textarea
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as RequestPriority)}
              >
                <SelectTrigger id="edit-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-due">Due date</Label>
              <Input
                id="edit-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-assignee">Assignee</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger id="edit-assignee" className="w-full">
                <SelectValue placeholder="Choose an assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role:agent">Agent queue</SelectItem>
                <SelectItem value="role:admin_tc">Admin / TC queue</SelectItem>
                <SelectItem value="role:marketing">Marketing queue</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={`user:${m.id}`}>
                    {m.name} · {ROLE_LABELS[m.role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete dialog (type DELETE to confirm) ────────────────────────────────────
function DeleteDialog({
  open,
  onOpenChange,
  requestId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  requestId: string;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const onConfirm = async () => {
    setBusy(true);
    const res = await softDeleteRequest(requestId);
    setBusy(false);
    if (res.ok) {
      toast.success("Request deleted.");
      router.push("/app/requests");
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this request?</DialogTitle>
          <DialogDescription>
            This removes the request from all queues. It is a soft delete and
            can be restored by an administrator. Type{" "}
            <span className="font-mono font-semibold">DELETE</span> to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="DELETE"
          aria-label="Type DELETE to confirm"
        />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={busy || text !== "DELETE"}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
