"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity as ActivityIcon,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  MoreHorizontal,
  Trash2,
  Upload,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { uploadDealFile } from "@/lib/storage";
import {
  addDealComment,
  changeDealStage,
  deleteDealFile,
  recordDealFile,
  setShareLinkEnabled,
  softDeleteDeal,
  updateDealFields,
} from "@/app/app/deals/actions";
import type { DealRow } from "@/lib/deals/queries";
import { formatBytes, formatCurrency, formatDate } from "@/lib/utils/format";
import { contingencyClearsLabel } from "@/lib/deals/contingency";
import {
  clientName,
  REPRESENTING_LABELS,
  stageStatusKey,
} from "@/lib/deals/format";
import { humanizeStatus } from "@/lib/constants/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { StatusChip } from "@/components/shared/status-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CurrencyInput,
  DecimalInput,
  FieldLabel,
  IntegerInput,
} from "@/components/deals/field-kit";

type StageOpt = {
  id: string;
  name: string;
  is_terminal_won: boolean;
  is_terminal_lost: boolean;
};
type AgentOpt = { id: string; name: string };

type FileItem = {
  id: string;
  name: string;
  sizeBytes: number | null;
  uploadedAt: string;
  uploaderName: string | null;
  uploadedByMe: boolean;
  url: string | null;
};
type ActivityItem = {
  id: string;
  event: string;
  payload: Record<string, unknown>;
  actorName: string | null;
  createdAt: string;
};
type CommentItem = {
  id: string;
  body: string;
  parentId: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  authorId: string | null;
  createdAt: string;
};

type Props = {
  deal: DealRow;
  displayId: string;
  primaryAgentName: string | null;
  stages: StageOpt[];
  agents: AgentOpt[];
  files: FileItem[];
  activity: ActivityItem[];
  comments: CommentItem[];
  currentUserId: string;
  currentUserCompanyId: string | null;
  canEdit: boolean;
  canManage: boolean;
  canDelete: boolean;
};

export function DealDetail(props: Props) {
  const { deal, stages, canEdit, canDelete } = props;
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const stageName = deal.stage?.name ?? null;

  const onChangeStage = async (stageId: string) => {
    if (stageId === deal.stage_id) return;
    const res = await changeDealStage(deal.id, stageId);
    if (res.ok) {
      toast.success("Stage updated.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-sm">
              {props.displayId}
            </span>
            {stageName ? (
              <StatusChip domain="deal" status={stageStatusKey(stageName)}>
                {stageName}
              </StatusChip>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {deal.property_address ?? "Untitled property"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {clientName(deal.client_first_name, deal.client_last_name)}
            {props.primaryAgentName ? ` · ${props.primaryAgentName}` : ""}
            {deal.representing
              ? ` · ${REPRESENTING_LABELS[deal.representing]}`
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Stage changer */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!canEdit}>
                {stageName ?? "Set stage"}
                <ChevronDown className="ml-1 size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={deal.stage_id ?? ""}
                onValueChange={onChangeStage}
              >
                {stages.map((s) => (
                  <DropdownMenuRadioItem key={s.id} value={s.id}>
                    {s.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Kebab */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Deal actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canDelete ? (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete deal
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>
                  No actions available
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">Files ({props.files.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="comments">
            Comments ({props.comments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab {...props} />
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <FilesTab {...props} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab activity={props.activity} />
        </TabsContent>
        <TabsContent value="comments" className="mt-4">
          <CommentsTab {...props} />
        </TabsContent>
      </Tabs>

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        dealId={deal.id}
        onDeleted={() => router.push("/app/deals")}
      />
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
type EditFields = {
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string;
  representing: "buyer" | "seller" | "dual" | "";
  rpa_signed_date: string;
  sales_price_cents: number | null;
  commission_pct: number | null;
  gci_cents: number | null;
  inspection_contingency_days: number | null;
  appraisal_contingency_days: number | null;
  loan_contingency_days: number | null;
  close_date: string;
  listing_broker: string;
  buy_side_broker: string;
};

function dealToEdit(deal: DealRow): EditFields {
  return {
    property_address: deal.property_address ?? "",
    property_city: deal.property_city ?? "",
    property_state: deal.property_state ?? "",
    property_zip: deal.property_zip ?? "",
    client_first_name: deal.client_first_name ?? "",
    client_last_name: deal.client_last_name ?? "",
    client_email: deal.client_email ?? "",
    client_phone: deal.client_phone ?? "",
    representing: deal.representing ?? "",
    rpa_signed_date: deal.rpa_signed_date ?? "",
    sales_price_cents: deal.sales_price_cents,
    commission_pct: deal.commission_pct,
    gci_cents: deal.gci_cents,
    inspection_contingency_days: deal.inspection_contingency_days,
    appraisal_contingency_days: deal.appraisal_contingency_days,
    loan_contingency_days: deal.loan_contingency_days,
    close_date: deal.close_date ?? "",
    listing_broker: deal.listing_broker ?? "",
    buy_side_broker: deal.buy_side_broker ?? "",
  };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function OverviewTab(props: Props) {
  const { deal, canEdit } = props;
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState<EditFields>(() => dealToEdit(deal));

  React.useEffect(() => {
    setF(dealToEdit(deal));
  }, [deal]);

  const set = <K extends keyof EditFields>(k: K, v: EditFields[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const onShareToggle = async (enabled: boolean) => {
    const res = await setShareLinkEnabled(deal.id, enabled);
    if (res.ok) {
      toast.success(enabled ? "Public link enabled." : "Public link disabled.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const onSave = async () => {
    setBusy(true);
    const patch = {
      ...f,
      representing: f.representing || undefined,
      property_city: f.property_city || null,
      property_state: f.property_state || null,
      property_zip: f.property_zip || null,
      client_email: f.client_email || null,
      client_phone: f.client_phone || null,
      close_date: f.close_date || null,
      listing_broker: f.listing_broker || null,
      buy_side_broker: f.buy_side_broker || null,
    };
    const res = await updateDealFields(deal.id, patch);
    setBusy(false);
    if (res.ok) {
      toast.success("Changes saved.");
      setEditing(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="e_addr" required>
              Property address
            </FieldLabel>
            <Input
              id="e_addr"
              value={f.property_address}
              onChange={(e) => set("property_address", e.target.value)}
            />
          </div>
          <Input
            aria-label="City"
            value={f.property_city}
            placeholder="City"
            onChange={(e) => set("property_city", e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label="State"
              maxLength={2}
              value={f.property_state}
              placeholder="State"
              onChange={(e) =>
                set("property_state", e.target.value.toUpperCase())
              }
            />
            <Input
              aria-label="ZIP"
              value={f.property_zip}
              placeholder="ZIP"
              onChange={(e) => set("property_zip", e.target.value)}
            />
          </div>
          <Input
            aria-label="Client first name"
            value={f.client_first_name}
            placeholder="Client first name"
            onChange={(e) => set("client_first_name", e.target.value)}
          />
          <Input
            aria-label="Client last name"
            value={f.client_last_name}
            placeholder="Client last name"
            onChange={(e) => set("client_last_name", e.target.value)}
          />
          <Input
            aria-label="Client email"
            value={f.client_email}
            placeholder="Client email"
            onChange={(e) => set("client_email", e.target.value)}
          />
          <Input
            aria-label="Client phone"
            value={f.client_phone}
            placeholder="Client phone"
            onChange={(e) => set("client_phone", e.target.value)}
          />
          <div>
            <FieldLabel htmlFor="e_rpa" required>
              RPA signed date
            </FieldLabel>
            <Input
              id="e_rpa"
              type="date"
              value={f.rpa_signed_date}
              onChange={(e) => set("rpa_signed_date", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="e_close" optional>
              Close date
            </FieldLabel>
            <Input
              id="e_close"
              type="date"
              value={f.close_date}
              onChange={(e) => set("close_date", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel optional>Sales price</FieldLabel>
            <CurrencyInput
              value={f.sales_price_cents}
              onChange={(c) => set("sales_price_cents", c)}
              placeholder="650,000"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel optional>Commission %</FieldLabel>
              <DecimalInput
                value={f.commission_pct}
                onChange={(n) => set("commission_pct", n)}
                suffix="%"
                placeholder="2.5"
                max={100}
              />
            </div>
            <div>
              <FieldLabel optional>GCI</FieldLabel>
              <CurrencyInput
                value={f.gci_cents}
                onChange={(c) => set("gci_cents", c)}
                placeholder="19,500"
              />
            </div>
          </div>
          <div>
            <FieldLabel optional>Inspection (days)</FieldLabel>
            <IntegerInput
              value={f.inspection_contingency_days}
              onChange={(n) => set("inspection_contingency_days", n)}
              placeholder="17"
            />
          </div>
          <div>
            <FieldLabel optional>Appraisal (days)</FieldLabel>
            <IntegerInput
              value={f.appraisal_contingency_days}
              onChange={(n) => set("appraisal_contingency_days", n)}
              placeholder="21"
            />
          </div>
          <div>
            <FieldLabel optional>Loan (days)</FieldLabel>
            <IntegerInput
              value={f.loan_contingency_days}
              onChange={(n) => set("loan_contingency_days", n)}
              placeholder="21"
            />
          </div>
          <Input
            aria-label="Listing broker"
            value={f.listing_broker}
            placeholder="Listing broker"
            onChange={(e) => set("listing_broker", e.target.value)}
          />
          <Input
            aria-label="Buy-side broker"
            value={f.buy_side_broker}
            placeholder="Buy-side broker"
            onChange={(e) => set("buy_side_broker", e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setF(dealToEdit(deal));
              setEditing(false);
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="bg-muted/40 flex items-center gap-3 rounded-md border px-3 py-2">
          <Switch
            id="share-toggle"
            checked={deal.public_share_link_enabled}
            onCheckedChange={onShareToggle}
            disabled={!canEdit}
          />
          <Label htmlFor="share-toggle" className="text-sm">
            Shared with client
            <span className="text-muted-foreground ml-1 text-xs font-normal">
              — public link enabled for this deal
            </span>
          </Label>
        </div>
        {canEdit ? (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <h3 className="mb-1 text-sm font-semibold">Property & client</h3>
            <Row label="Address" value={deal.property_address} />
            <Row
              label="City / State / ZIP"
              value={[
                deal.property_city,
                deal.property_state,
                deal.property_zip,
              ]
                .filter(Boolean)
                .join(", ")}
            />
            <Row
              label="Client"
              value={clientName(deal.client_first_name, deal.client_last_name)}
            />
            <Row label="Email" value={deal.client_email} />
            <Row label="Phone" value={deal.client_phone} />
            <Row
              label="Representing"
              value={
                deal.representing
                  ? REPRESENTING_LABELS[deal.representing]
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <h3 className="mb-1 text-sm font-semibold">Terms</h3>
            <Row
              label="RPA signed"
              value={
                deal.rpa_signed_date
                  ? formatDate(deal.rpa_signed_date, "short")
                  : null
              }
            />
            <Row
              label="Sales price"
              value={
                deal.sales_price_cents != null
                  ? formatCurrency(deal.sales_price_cents)
                  : null
              }
            />
            <Row
              label="Commission"
              value={
                deal.commission_pct != null ? `${deal.commission_pct}%` : null
              }
            />
            <Row
              label="GCI"
              value={
                deal.gci_cents != null ? formatCurrency(deal.gci_cents) : null
              }
            />
            <Row
              label="Close date"
              value={
                deal.close_date ? formatDate(deal.close_date, "short") : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <h3 className="mb-1 text-sm font-semibold">Contingencies</h3>
            <Row
              label="Inspection"
              value={
                deal.inspection_contingency_days != null
                  ? `${deal.inspection_contingency_days} days · ${
                      contingencyClearsLabel(
                        deal.rpa_signed_date,
                        deal.inspection_contingency_days,
                      ) ?? "—"
                    }`
                  : null
              }
            />
            <Row
              label="Appraisal"
              value={
                deal.appraisal_contingency_days != null
                  ? `${deal.appraisal_contingency_days} days · ${
                      contingencyClearsLabel(
                        deal.rpa_signed_date,
                        deal.appraisal_contingency_days,
                      ) ?? "—"
                    }`
                  : null
              }
            />
            <Row
              label="Loan"
              value={
                deal.loan_contingency_days != null
                  ? `${deal.loan_contingency_days} days · ${
                      contingencyClearsLabel(
                        deal.rpa_signed_date,
                        deal.loan_contingency_days,
                      ) ?? "—"
                    }`
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <h3 className="mb-1 text-sm font-semibold">Agents & brokers</h3>
            <Row label="Listing agent" value={deal.listing_agent?.full_name} />
            <Row
              label="Co-listing agent"
              value={deal.co_listing_agent?.full_name}
            />
            <Row label="Buyer's agent" value={deal.buyer_agent?.full_name} />
            <Row label="Listing broker" value={deal.listing_broker} />
            <Row label="Buy-side broker" value={deal.buy_side_broker} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Files ─────────────────────────────────────────────────────────────────────
function FilesTab(props: Props) {
  const { deal, files, currentUserCompanyId, canManage } = props;
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  const onUpload = async (list: FileList) => {
    if (!currentUserCompanyId) {
      toast.error("No company context.");
      return;
    }
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > 10 * 1024 * 1024);
    if (tooBig) {
      toast.error("Please upload files under 10MB.");
      return;
    }
    setBusy(true);
    try {
      for (const file of arr) {
        const { path } = await uploadDealFile(supabase, {
          companyId: currentUserCompanyId,
          dealId: deal.id,
          filename: file.name,
          file,
        });
        const res = await recordDealFile(deal.id, {
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
    const res = await deleteDealFile(id);
    if (res.ok) {
      toast.success("File deleted.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Upload files
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onUpload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length === 0 ? (
        <p className="text-muted-foreground text-sm">No files yet.</p>
      ) : (
        <div className="divide-y rounded-md border">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 p-3">
              <FileText className="text-muted-foreground size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-muted-foreground text-xs">
                  {file.sizeBytes ? `${formatBytes(file.sizeBytes)} · ` : ""}
                  {file.uploaderName ? `${file.uploaderName} · ` : ""}
                  {formatDate(file.uploadedAt, "short")}
                </p>
              </div>
              {file.url ? (
                <Button asChild variant="ghost" size="sm">
                  <a href={file.url} target="_blank" rel="noreferrer" download>
                    <Download className="size-4" />
                    Download
                  </a>
                </Button>
              ) : null}
              {canManage || file.uploadedByMe ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${file.name}`}
                  onClick={() => onDelete(file.id, file.name)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activity ──────────────────────────────────────────────────────────────────
function activityLabel(item: ActivityItem): string {
  const p = item.payload ?? {};
  switch (item.event) {
    case "created":
      return "created the deal";
    case "stage_changed":
      return `moved stage${p.from ? ` from ${p.from}` : ""}${
        p.to ? ` to ${p.to}` : ""
      }`;
    case "field_updated": {
      const fields = Array.isArray(p.fields) ? (p.fields as string[]) : [];
      const names = fields.map((x) => humanizeStatus(x)).join(", ");
      return `updated ${names || "fields"}`;
    }
    case "file_uploaded":
      return `uploaded ${p.filename ? `"${p.filename}"` : "a file"}`;
    case "ai_extracted":
      return "ran AI extraction";
    case "comment_added":
      return "added a comment";
    default:
      return item.event;
  }
}

function ActivityTab({ activity }: { activity: ActivityItem[] }) {
  if (activity.length === 0) {
    return <p className="text-muted-foreground text-sm">No activity yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {activity.map((item) => (
        <li key={item.id} className="flex gap-3 text-sm">
          <div className="bg-muted text-muted-foreground mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
            <ActivityIcon className="size-3.5" />
          </div>
          <div>
            <p>
              <span className="font-medium">{item.actorName ?? "Someone"}</span>{" "}
              {activityLabel(item)}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatDate(item.createdAt, "relative")}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Comments ──────────────────────────────────────────────────────────────────
function CommentsTab(props: Props) {
  const { deal, comments } = props;
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const [replyBody, setReplyBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  const post = async (text: string, parentId: string | null) => {
    if (!text.trim()) return;
    setBusy(true);
    const res = await addDealComment(deal.id, { body: text, parentId });
    setBusy(false);
    if (res.ok) {
      setBody("");
      setReplyBody("");
      setReplyTo(null);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            onClick={() => post(body, null)}
            disabled={busy || !body.trim()}
          >
            Comment
          </Button>
        </div>
      </div>

      {topLevel.length === 0 ? (
        <p className="text-muted-foreground text-sm">No comments yet.</p>
      ) : (
        <ul className="space-y-4">
          {topLevel.map((c) => (
            <li key={c.id} className="space-y-3">
              <CommentBubble c={c} />
              <div className="space-y-3 border-l pl-6">
                {repliesOf(c.id).map((r) => (
                  <CommentBubble key={r.id} c={r} />
                ))}
                {replyTo === c.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write a reply…"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => post(replyBody, c.id)}
                        disabled={busy || !replyBody.trim()}
                      >
                        Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReplyTo(null);
                          setReplyBody("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-xs"
                    onClick={() => {
                      setReplyTo(c.id);
                      setReplyBody("");
                    }}
                  >
                    Reply
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentBubble({ c }: { c: CommentItem }) {
  return (
    <div className="flex gap-3">
      <UserAvatar
        size="sm"
        name={c.authorName}
        src={c.authorAvatar}
        seed={c.authorId}
      />
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-medium">{c.authorName ?? "Someone"}</span>{" "}
          <span className="text-muted-foreground text-xs">
            {formatDate(c.createdAt, "relative")}
          </span>
        </p>
        <p className="text-sm whitespace-pre-wrap">{c.body}</p>
      </div>
    </div>
  );
}

// ── Delete dialog (type DELETE to confirm) ────────────────────────────────────
function DeleteDialog({
  open,
  onOpenChange,
  dealId,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  onDeleted: () => void;
}) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const onConfirm = async () => {
    setBusy(true);
    const res = await softDeleteDeal(dealId);
    setBusy(false);
    if (res.ok) {
      toast.success("Deal deleted.");
      onDeleted();
    } else {
      toast.error(res.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this deal?</DialogTitle>
          <DialogDescription>
            This removes the deal from all lists. It is a soft delete and can be
            restored by an administrator. Type{" "}
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
            Delete deal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
