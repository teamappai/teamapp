"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Paperclip, Upload, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { uploadRequestFile } from "@/lib/storage";
import { createRequest } from "@/app/app/requests/actions";
import { ROLE_LABELS, type UserRole } from "@/lib/constants/roles";
import {
  MAX_REQUEST_FILE_MB,
  PRIORITIES,
  PRIORITY_LABELS,
  REQUEST_FILE_ACCEPT,
  REQUEST_FILE_HINT,
  type RequestCategory,
  type RequestPriority,
} from "@/lib/requests/format";
import { formatBytes } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/shared/status-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils/index";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TypeOpt = {
  id: string;
  name: string;
  defaultAssigneeRole: UserRole | null;
  category: string;
};
type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
};
type DealOpt = { id: string; label: string };

type Props = {
  companyId: string | null;
  types: TypeOpt[];
  members: Member[];
  deals: DealOpt[];
};

const NONE = "__none__";
const ROLE_QUEUE_OPTIONS: UserRole[] = ["agent", "admin_tc", "marketing"];

/** Local YYYY-MM-DD for `today + n days` (never UTC — avoids day shifts). */
function isoInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const y = d.getFullYear().toString().padStart(4, "0");
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type AssigneeMode = "user" | "role";

export function RequestForm({ companyId, types, members, deals }: Props) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const [typeId, setTypeId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<RequestPriority>("normal");
  const [dueDate, setDueDate] = React.useState("");
  const [relatedDealId, setRelatedDealId] = React.useState(NONE);

  const [mode, setMode] = React.useState<AssigneeMode>("user");
  const [assignedRole, setAssignedRole] = React.useState<UserRole>("agent");
  const [assignedUserId, setAssignedUserId] = React.useState<string | null>(
    null,
  );

  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const selectedType = types.find((t) => t.id === typeId) ?? null;
  const category = (selectedType?.category ?? "other") as RequestCategory;
  const hintRole = selectedType?.defaultAssigneeRole ?? null;

  // Smart assignment (PA-4): when the type changes, set sensible defaults.
  const onTypeChange = (id: string) => {
    setTypeId(id);
    const t = types.find((x) => x.id === id);
    if (!t) return;
    const cat = t.category as RequestCategory;
    // Due date default by category (never today — F-140): field work is more
    // time-sensitive (+3 days); everything else +7.
    setDueDate(isoInDays(cat === "field_work" ? 3 : 7));

    if (
      (cat === "agent_support" || cat === "transaction_admin") &&
      t.defaultAssigneeRole
    ) {
      setMode("role");
      setAssignedRole(t.defaultAssigneeRole);
      setAssignedUserId(null);
    } else {
      // field_work → specific person (with role hint); other → user by default.
      setMode("user");
      setAssignedUserId(null);
      if (t.defaultAssigneeRole) setAssignedRole(t.defaultAssigneeRole);
    }
  };

  const addFiles = (list: FileList | File[]) => {
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > MAX_REQUEST_FILE_MB * 1024 * 1024);
    if (tooBig) {
      toast.error(`Each file must be under ${MAX_REQUEST_FILE_MB}MB.`);
      return;
    }
    setFiles((prev) => [...prev, ...arr]);
  };

  const removeFile = (i: number) =>
    setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const onSubmit = async () => {
    if (!typeId) {
      toast.error("Select a request type.");
      return;
    }
    if (title.trim().length < 3) {
      toast.error("Title must be at least 3 characters.");
      return;
    }
    const assignedToUserId = mode === "user" ? assignedUserId : null;
    const assignedToRole = mode === "role" ? assignedRole : null;
    if (!assignedToUserId && !assignedToRole) {
      toast.error("Assign this request to a person or a role queue.");
      return;
    }

    setBusy(true);
    try {
      const res = await createRequest({
        requestTypeId: typeId,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        dueDate: dueDate || null,
        relatedDealId: relatedDealId === NONE ? null : relatedDealId,
        assignedToUserId,
        assignedToRole,
      });
      if (!res.ok) {
        toast.error(res.error);
        setBusy(false);
        return;
      }

      // Attach files to the freshly created request.
      if (files.length && companyId) {
        const { recordRequestFile } =
          await import("@/app/app/requests/actions");
        for (const file of files) {
          try {
            const { path } = await uploadRequestFile(supabase, {
              companyId,
              requestId: res.requestId,
              filename: file.name,
              file,
            });
            await recordRequestFile(res.requestId, {
              storagePath: path,
              originalFilename: file.name,
              fileSizeBytes: file.size,
              contentType: file.type || null,
            });
          } catch (err) {
            console.error(err);
            toast.error(`Could not upload "${file.name}".`);
          }
        }
      }

      toast.success("Request created.");
      router.push(`/app/requests/${res.requestId}`);
    } catch (err) {
      console.error(err);
      toast.error("Could not create the request.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Request type leads, required, no "All Types" (F-125/F-137) */}
      <div className="space-y-1.5">
        <Label htmlFor="req-type">
          Request type <span className="text-destructive">*</span>
        </Label>
        <Select value={typeId} onValueChange={onTypeChange}>
          <SelectTrigger id="req-type" className="w-full">
            <SelectValue placeholder="Select a type…" />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="req-title">
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          id="req-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Flyer for 123 Main St open house"
          maxLength={200}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="req-desc">Description</Label>
        <Textarea
          id="req-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add any details the assignee needs…"
          rows={4}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="req-due">Due date</Label>
          <Input
            id="req-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Optional — leave blank for &ldquo;best effort&rdquo;.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="req-priority">Priority</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as RequestPriority)}
          >
            <SelectTrigger id="req-priority" className="w-full">
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
      </div>

      {deals.length > 0 ? (
        <div className="space-y-1.5">
          <Label htmlFor="req-deal">Related deal</Label>
          <Select value={relatedDealId} onValueChange={setRelatedDealId}>
            <SelectTrigger id="req-deal" className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {deals.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Optional — narrows what data the assignee needs.
          </p>
        </div>
      ) : null}

      {/* Assignee — smart-routed by request type (PA-4) */}
      <div className="space-y-2">
        <Label>Assignee</Label>
        <div className="inline-flex rounded-md border p-0.5">
          <button
            type="button"
            onClick={() => setMode("user")}
            className={cn(
              "rounded px-3 py-1 text-sm",
              mode === "user"
                ? "bg-secondary font-medium"
                : "text-muted-foreground",
            )}
          >
            Specific person
          </button>
          <button
            type="button"
            onClick={() => setMode("role")}
            className={cn(
              "rounded px-3 py-1 text-sm",
              mode === "role"
                ? "bg-secondary font-medium"
                : "text-muted-foreground",
            )}
          >
            Role queue
          </button>
        </div>

        {mode === "role" ? (
          <div className="space-y-1.5">
            <Select
              value={assignedRole}
              onValueChange={(v) => setAssignedRole(v as UserRole)}
            >
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_QUEUE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    Assign to {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              The request sits in this role&rsquo;s shared queue until someone
              claims it.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <AssigneePicker
              members={members}
              selectedId={assignedUserId}
              onSelect={setAssignedUserId}
            />
            {hintRole && category === "field_work" ? (
              <p className="text-muted-foreground text-xs">
                Typically assigned to: {ROLE_LABELS[hintRole]}
              </p>
            ) : null}
          </div>
        )}
      </div>

      {/* Attachments (F-130) */}
      <div className="space-y-2">
        <Label>Attachments</Label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex w-full flex-col items-center gap-1 rounded-md border border-dashed px-4 py-6 text-sm transition-colors",
            dragging ? "border-primary bg-accent" : "hover:bg-accent/50",
          )}
        >
          <Upload className="text-muted-foreground size-5" />
          <span>
            <span className="text-primary font-medium">Click to upload</span> or
            drag and drop
          </span>
          <span className="text-muted-foreground text-xs">
            {REQUEST_FILE_HINT}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={REQUEST_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {files.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-3 p-2.5 text-sm">
                <Paperclip className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-muted-foreground text-xs">
                  {formatBytes(f.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`Remove ${f.name}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          variant="ghost"
          onClick={() => router.push("/app/requests")}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Create request
        </Button>
      </div>
    </div>
  );
}

/** Typeahead person picker (no shadcn Command primitive available). */
function AssigneePicker({
  members,
  selectedId,
  onSelect,
}: {
  members: Member[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const selected = members.find((m) => m.id === selectedId) ?? null;

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members.slice(0, 8);
    return members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [members, query]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2">
        <UserAvatar
          size="sm"
          name={selected.name}
          src={selected.avatarUrl}
          seed={selected.id}
        />
        <span className="flex-1 text-sm font-medium">{selected.name}</span>
        <StatusChip variant="neutral" hideDot>
          {ROLE_LABELS[selected.role]}
        </StatusChip>
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="Clear assignee"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative sm:w-96">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search teammates by name…"
      />
      {open && matches.length > 0 ? (
        <ul className="bg-popover absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border p-1 shadow-md">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(m.id);
                  setOpen(false);
                }}
                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
              >
                <UserAvatar
                  size="sm"
                  name={m.name}
                  src={m.avatarUrl}
                  seed={m.id}
                />
                <span className="flex-1">{m.name}</span>
                <StatusChip variant="neutral" hideDot>
                  {ROLE_LABELS[m.role]}
                </StatusChip>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
