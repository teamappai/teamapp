"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Papa from "papaparse";
import { Upload, X } from "lucide-react";

import Link from "next/link";
import { CreditCard } from "lucide-react";

import {
  inviteSingle,
  inviteBulk,
  type SeatLimitInfo,
} from "@/app/app/users/actions";
import { formatCurrency } from "@/lib/utils/format";
import {
  INVITABLE_ROLES,
  ROLE_DESCRIPTIONS,
  BULK_INVITE_MAX,
  type InvitableRole,
} from "@/lib/validations/team";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AssignableModule = {
  id: string;
  title: string;
  visibleToRoles: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingEmails: string[];
  assignableModules: AssignableModule[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-destructive mt-1 text-xs">{children}</p>;
}

/**
 * Seat-cap upgrade prompt (Decision 4 — C). Shown when an invite is hard-blocked
 * at the seat limit: offers a positive path (upgrade or add seats) instead of a
 * dead end. Both CTAs route to Billing where the actual change happens.
 */
function SeatLimitPrompt({ info }: { info: SeatLimitInfo }) {
  return (
    <div className="border-destructive/30 bg-destructive/5 space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">
        You&rsquo;ve reached your seat limit ({info.used} of {info.total} seats
        used).
      </p>
      <p className="text-muted-foreground text-xs">
        Add seats from Billing to keep inviting your team.
      </p>
      <div className="flex flex-wrap gap-2">
        {info.nextPlan && info.nextPlanName ? (
          <Button asChild size="sm">
            <Link href="/app/billing">Upgrade to {info.nextPlanName}</Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline">
          <Link href="/app/billing">
            <CreditCard className="size-4" />
            Add seats
            {info.perSeatMonthlyCents > 0
              ? ` (${formatCurrency(info.perSeatMonthlyCents)}/seat/mo)`
              : ""}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function RoleSelect({
  value,
  onChange,
  id,
}: {
  value: InvitableRole;
  onChange: (v: InvitableRole) => void;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as InvitableRole)}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {INVITABLE_ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            <span className="flex flex-col">
              <span className="font-medium">{ROLE_LABELS[r]}</span>
              <span className="text-muted-foreground text-xs">
                {ROLE_DESCRIPTIONS[r]}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── single invite ─────────────────────────────────────────────────────────────
function SingleInvite({
  existingEmails,
  assignableModules,
  onDone,
}: {
  existingEmails: Set<string>;
  assignableModules: AssignableModule[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<InvitableRole>("agent");
  const [welcome, setWelcome] = React.useState("");
  const [moduleIds, setModuleIds] = React.useState<string[]>([]);
  const [touchedModules, setTouchedModules] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [seatLimit, setSeatLimit] = React.useState<SeatLimitInfo | null>(null);
  const [pending, start] = React.useTransition();

  // Default the module selection to those visible to the chosen role until the
  // user manually edits the selection.
  const defaultModules = React.useMemo(
    () =>
      assignableModules
        .filter(
          (m) =>
            m.visibleToRoles.length === 0 || m.visibleToRoles.includes(role),
        )
        .map((m) => m.id),
    [assignableModules, role],
  );
  React.useEffect(() => {
    if (!touchedModules) setModuleIds(defaultModules);
  }, [defaultModules, touchedModules]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = "Enter a full name.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email.";
    else if (existingEmails.has(email.trim().toLowerCase())) {
      next.email = "This email already has an account or pending invite.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (!validate()) return;
    start(async () => {
      const res = await inviteSingle({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        welcomeMessage: welcome.trim() || undefined,
        assignedModuleIds: moduleIds,
      });
      if (res.ok) {
        toast.success("1 invitation sent. They'll receive an email shortly.");
        router.refresh();
        onDone();
      } else {
        setErrors({ form: res.seatLimit ? "" : res.error });
        setSeatLimit(res.seatLimit ?? null);
      }
    });
  }

  return (
    <div className="space-y-4 py-2">
      <div>
        <Label htmlFor="inv-name">Full name</Label>
        <Input
          id="inv-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jordan Rivera"
        />
        <FieldError>{errors.fullName}</FieldError>
      </div>
      <div>
        <Label htmlFor="inv-email">Email</Label>
        <Input
          id="inv-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jordan@example.com"
        />
        <FieldError>{errors.email}</FieldError>
      </div>
      <div>
        <Label htmlFor="inv-role">Role</Label>
        <RoleSelect id="inv-role" value={role} onChange={setRole} />
        <p className="text-muted-foreground mt-1 text-xs">
          {ROLE_DESCRIPTIONS[role]}
        </p>
      </div>
      <div>
        <Label htmlFor="inv-welcome">Welcome message (optional)</Label>
        <Textarea
          id="inv-welcome"
          value={welcome}
          onChange={(e) => setWelcome(e.target.value)}
          rows={2}
          placeholder="Excited to have you on the team!"
        />
      </div>
      {assignableModules.length > 0 && (
        <div>
          <Label>Assign training modules (optional)</Label>
          <div className="mt-1 max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2">
            {assignableModules.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={moduleIds.includes(m.id)}
                  onCheckedChange={(checked) => {
                    setTouchedModules(true);
                    setModuleIds((ids) =>
                      checked
                        ? [...ids, m.id]
                        : ids.filter((id) => id !== m.id),
                    );
                  }}
                />
                {m.title}
              </label>
            ))}
          </div>
        </div>
      )}
      <FieldError>{errors.form}</FieldError>
      {seatLimit ? <SeatLimitPrompt info={seatLimit} /> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </div>
  );
}

// ── bulk invite ─────────────────────────────────────────────────────────────--
type ParsedRow = {
  fullName: string;
  email: string;
  role: InvitableRole;
  error?: string;
};

function normalizeRole(value: string | undefined): InvitableRole {
  const v = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s/-]+/g, "_");
  if ((INVITABLE_ROLES as readonly string[]).includes(v)) {
    return v as InvitableRole;
  }
  return "agent";
}

function validateRows(rows: ParsedRow[]): ParsedRow[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    let error: string | undefined;
    const key = r.email.toLowerCase();
    if (!EMAIL_RE.test(r.email)) error = "Invalid email";
    else if (seen.has(key)) error = "Duplicate in list";
    seen.set(key, (seen.get(key) ?? 0) + 1);
    return { ...r, error };
  });
}

function BulkInvite({
  existingEmails,
  onDone,
}: {
  existingEmails: Set<string>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"paste" | "csv">("paste");
  const [pasteText, setPasteText] = React.useState("");
  const [pasteRole, setPasteRole] = React.useState<InvitableRole>("agent");
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [welcome, setWelcome] = React.useState("");
  const [formError, setFormError] = React.useState<string>();
  const [seatLimit, setSeatLimit] = React.useState<SeatLimitInfo | null>(null);
  const [pending, start] = React.useTransition();
  const fileRef = React.useRef<HTMLInputElement>(null);

  function applyConflicts(input: ParsedRow[]): ParsedRow[] {
    const validated = validateRows(input);
    return validated.map((r) =>
      !r.error && existingEmails.has(r.email.toLowerCase())
        ? { ...r, error: "Already in company" }
        : r,
    );
  }

  function parsePaste() {
    const emails = pasteText
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    const parsed: ParsedRow[] = emails.map((email) => ({
      fullName: "",
      email: email.toLowerCase(),
      role: pasteRole,
    }));
    if (parsed.length > BULK_INVITE_MAX) {
      setFormError(
        "Please split into batches of 100 or fewer. Bulk imports of 1000+ users are coming in a future release.",
      );
      return;
    }
    setFormError(undefined);
    setRows(applyConflicts(parsed));
  }

  function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (result) => {
        const parsed: ParsedRow[] = result.data.map((row) => ({
          fullName: (row.full_name ?? "").trim(),
          email: (row.email ?? "").trim().toLowerCase(),
          role: normalizeRole(row.role),
        }));
        if (parsed.length > BULK_INVITE_MAX) {
          setFormError(
            "Please split into batches of 100 or fewer. Bulk imports of 1000+ users are coming in a future release.",
          );
          setRows([]);
          return;
        }
        setFormError(undefined);
        setRows(applyConflicts(parsed));
      },
    });
    e.target.value = "";
  }

  function setRowRole(index: number, role: InvitableRole) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, role } : r)));
  }

  function removeRow(index: number) {
    setRows((rs) => applyConflicts(rs.filter((_, i) => i !== index)));
  }

  const validRows = rows.filter((r) => !r.error);
  const hasErrors = rows.some((r) => r.error);

  function submit() {
    if (validRows.length === 0) {
      setFormError("Add at least one valid invitee.");
      return;
    }
    start(async () => {
      const res = await inviteBulk({
        rows: validRows.map((r) => ({
          fullName: r.fullName || undefined,
          email: r.email,
          role: r.role,
        })),
        welcomeMessage: welcome.trim() || undefined,
      });
      if (res.ok) {
        const count = "count" in res ? res.count : validRows.length;
        toast.success(
          `${count} invitations sent. They'll receive an email shortly.`,
        );
        router.refresh();
        onDone();
      } else {
        setFormError(res.seatLimit ? undefined : res.error);
        setSeatLimit(res.seatLimit ?? null);
      }
    });
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "paste" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("paste")}
        >
          Paste emails
        </Button>
        <Button
          type="button"
          variant={mode === "csv" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("csv")}
        >
          Upload CSV
        </Button>
      </div>

      {mode === "paste" ? (
        <div className="space-y-2">
          <Label htmlFor="bulk-paste">
            Emails (one per line or comma-separated)
          </Label>
          <Textarea
            id="bulk-paste"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={4}
            placeholder={"agent1@example.com\nagent2@example.com"}
          />
          <div className="flex items-end gap-2">
            <div className="w-48">
              <Label className="text-xs">Default role</Label>
              <RoleSelect value={pasteRole} onChange={setPasteRole} />
            </div>
            <Button type="button" variant="secondary" onClick={parsePaste}>
              Preview
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            CSV columns: <code>full_name</code>, <code>email</code>,{" "}
            <code>role</code> (agent, admin_tc, or marketing).
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onCsv}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" /> Choose CSV file
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>
              {validRows.length} ready
              {hasErrors
                ? ` · ${rows.length - validRows.length} with errors`
                : ""}
            </span>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.email}-${i}`}
                    className="border-b last:border-0"
                  >
                    <td className="p-2">
                      <div className="font-medium">{r.email || "—"}</div>
                      {r.fullName && (
                        <div className="text-muted-foreground text-xs">
                          {r.fullName}
                        </div>
                      )}
                      {r.error && (
                        <div className="text-destructive text-xs">
                          {r.error}
                        </div>
                      )}
                    </td>
                    <td className="w-44 p-2">
                      <RoleSelect
                        value={r.role}
                        onChange={(role) => setRowRole(i, role)}
                      />
                    </td>
                    <td className="w-10 p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove row"
                        onClick={() => removeRow(i)}
                      >
                        <X className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <Label htmlFor="bulk-welcome">Welcome message (optional)</Label>
            <Textarea
              id="bulk-welcome"
              value={welcome}
              onChange={(e) => setWelcome(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      )}

      <FieldError>{formError}</FieldError>
      {seatLimit ? <SeatLimitPrompt info={seatLimit} /> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending || validRows.length === 0}>
          {pending
            ? "Sending…"
            : `Send ${validRows.length || ""} invite${validRows.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

export function InviteUsersDialog({
  open,
  onOpenChange,
  existingEmails,
  assignableModules,
}: Props) {
  const existing = React.useMemo(
    () => new Set(existingEmails.map((e) => e.toLowerCase())),
    [existingEmails],
  );
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite users</DialogTitle>
          <DialogDescription>
            Invite a single teammate or bulk-invite by paste or CSV.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="single">
          <TabsList>
            <TabsTrigger value="single">Single invite</TabsTrigger>
            <TabsTrigger value="bulk">Bulk invite</TabsTrigger>
          </TabsList>
          <TabsContent value="single">
            <SingleInvite
              existingEmails={existing}
              assignableModules={assignableModules}
              onDone={close}
            />
          </TabsContent>
          <TabsContent value="bulk">
            <BulkInvite existingEmails={existing} onDone={close} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
