"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, Upload, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { uploadDealFile } from "@/lib/storage";
import {
  createDraftDeal,
  saveDealDraft,
  submitDeal,
  recordDealFile,
} from "@/app/app/deals/actions";
import { dealStep2Schema, dealStep3Schema } from "@/lib/validations/deal";
import type { ExtractedFields, FieldConfidence } from "@/lib/ai/types";
import { formatBytes, formatCurrency, formatDate } from "@/lib/utils/format";
import { contingencyClearsLabel } from "@/lib/deals/contingency";
import { clientName, REPRESENTING_LABELS } from "@/lib/deals/format";
import { cn } from "@/lib/utils/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AiPill,
  ConfirmedPill,
  CurrencyInput,
  DecimalInput,
  FieldError,
  FieldLabel,
  IntegerInput,
} from "@/components/deals/field-kit";

const MAX_FILE_MB = 10;

type Representing = "buyer" | "seller" | "dual";
type AgentOption = { id: string; name: string };

export type Fields = {
  property_address: string;
  property_city: string;
  property_state: string;
  property_zip: string;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string;
  representing: Representing | "";
  rpa_signed_date: string;
  sales_price_cents: number | null;
  commission_pct: number | null;
  gci_cents: number | null;
  inspection_contingency_days: number | null;
  appraisal_contingency_days: number | null;
  loan_contingency_days: number | null;
  close_date: string;
  listing_agent_id: string;
  co_listing_agent_id: string;
  buyer_agent_id: string;
  listing_broker: string;
  buy_side_broker: string;
  deal_type_id: string;
};

const EMPTY_FIELDS: Fields = {
  property_address: "",
  property_city: "",
  property_state: "",
  property_zip: "",
  client_first_name: "",
  client_last_name: "",
  client_email: "",
  client_phone: "",
  representing: "",
  rpa_signed_date: "",
  sales_price_cents: null,
  commission_pct: null,
  gci_cents: null,
  inspection_contingency_days: null,
  appraisal_contingency_days: null,
  loan_contingency_days: null,
  close_date: "",
  listing_agent_id: "",
  co_listing_agent_id: "",
  buyer_agent_id: "",
  listing_broker: "",
  buy_side_broker: "",
  deal_type_id: "",
};

/** AI-suggestable keys (a subset of Fields). */
type AiKey = keyof ExtractedFields;

type DealFileMeta = {
  id: string;
  name: string;
  sizeBytes: number;
  contentType: string;
};

type State = {
  step: 1 | 2 | 3 | 4;
  dealId: string | null;
  companyId: string | null;
  files: DealFileMeta[];
  fields: Fields;
  ai: Partial<Record<AiKey, number | undefined>>; // key -> confidence (presence = suggested)
  confirmed: Set<string>;
  gciTouched: boolean;
  errors: Record<string, string>;
};

type Action =
  | { type: "SET_STEP"; step: State["step"] }
  | { type: "SET_DRAFT"; dealId: string; companyId: string }
  | { type: "ADD_FILES"; files: DealFileMeta[] }
  | { type: "REMOVE_FILE"; id: string }
  | { type: "SET_FIELD"; key: keyof Fields; value: Fields[keyof Fields] }
  | { type: "APPLY_AI"; fields: ExtractedFields; confidence: FieldConfidence }
  | { type: "CONFIRM_FIELD"; key: string }
  | { type: "SET_ERRORS"; errors: Record<string, string> };

const initialState: State = {
  step: 1,
  dealId: null,
  companyId: null,
  files: [],
  fields: EMPTY_FIELDS,
  ai: {},
  confirmed: new Set(),
  gciTouched: false,
  errors: {},
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step, errors: {} };
    case "SET_DRAFT":
      return { ...state, dealId: action.dealId, companyId: action.companyId };
    case "ADD_FILES":
      return { ...state, files: [...state.files, ...action.files] };
    case "REMOVE_FILE":
      return { ...state, files: state.files.filter((f) => f.id !== action.id) };
    case "SET_FIELD": {
      const fields = { ...state.fields, [action.key]: action.value };
      // GCI auto-calc from price × commission % unless the user edited GCI.
      let gciTouched = state.gciTouched;
      if (action.key === "gci_cents") gciTouched = true;
      if (
        !gciTouched &&
        (action.key === "sales_price_cents" || action.key === "commission_pct")
      ) {
        const price = fields.sales_price_cents;
        const pct = fields.commission_pct;
        fields.gci_cents =
          price != null && pct != null ? Math.round((price * pct) / 100) : null;
      }
      // Editing a field that had an AI suggestion counts as confirming it.
      const confirmed = new Set(state.confirmed);
      if (action.key in state.ai) confirmed.add(action.key as string);
      return { ...state, fields, gciTouched, confirmed };
    }
    case "APPLY_AI": {
      const fields = { ...state.fields };
      const ai: State["ai"] = { ...state.ai };
      (Object.keys(action.fields) as AiKey[]).forEach((key) => {
        const value = action.fields[key];
        if (value == null) return;
        // Apply into the matching form field.
        if (key === "sales_price_cents") {
          fields.sales_price_cents = value as number;
        } else if (
          key === "inspection_contingency_days" ||
          key === "appraisal_contingency_days" ||
          key === "loan_contingency_days"
        ) {
          fields[key] = value as number;
        } else if (key === "representing") {
          fields.representing = value as Representing;
        } else {
          // string fields
          (fields as Record<string, unknown>)[key] = String(value);
        }
        ai[key] = action.confidence[key];
      });
      return { ...state, fields, ai };
    }
    case "CONFIRM_FIELD": {
      const confirmed = new Set(state.confirmed);
      confirmed.add(action.key);
      return { ...state, confirmed };
    }
    case "SET_ERRORS":
      return { ...state, errors: action.errors };
    default:
      return state;
  }
}

function emptyToNull(v: string): string | null {
  return v.trim() ? v.trim() : null;
}

/** Build the typed payload from the form for draft/submit server actions. */
function buildPayload(f: Fields) {
  return {
    property_address: f.property_address.trim(),
    property_city: emptyToNull(f.property_city),
    property_state: emptyToNull(f.property_state),
    property_zip: emptyToNull(f.property_zip),
    client_first_name: f.client_first_name.trim(),
    client_last_name: f.client_last_name.trim(),
    client_email: emptyToNull(f.client_email),
    client_phone: emptyToNull(f.client_phone),
    representing: f.representing || undefined,
    rpa_signed_date: f.rpa_signed_date,
    sales_price_cents: f.sales_price_cents,
    commission_pct: f.commission_pct,
    gci_cents: f.gci_cents,
    inspection_contingency_days: f.inspection_contingency_days,
    appraisal_contingency_days: f.appraisal_contingency_days,
    loan_contingency_days: f.loan_contingency_days,
    close_date: emptyToNull(f.close_date),
    listing_agent_id: emptyToNull(f.listing_agent_id),
    co_listing_agent_id: emptyToNull(f.co_listing_agent_id),
    buyer_agent_id: emptyToNull(f.buyer_agent_id),
    listing_broker: emptyToNull(f.listing_broker),
    buy_side_broker: emptyToNull(f.buy_side_broker),
    deal_type_id: emptyToNull(f.deal_type_id),
  };
}

export function DealWizard({
  agents,
  dealTypes,
}: {
  agents: AgentOption[];
  dealTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, dispatch] = React.useReducer(reducer, {
    ...initialState,
    fields: { ...EMPTY_FIELDS, buyer_agent_id: "", listing_agent_id: "" },
  });
  const [busy, setBusy] = React.useState(false);
  const supabase = React.useMemo(() => createClient(), []);

  /** Ensure a draft deal row exists (so files can attach); returns its id. */
  const ensureDraft = React.useCallback(async (): Promise<{
    dealId: string;
    companyId: string;
  } | null> => {
    if (state.dealId && state.companyId) {
      return { dealId: state.dealId, companyId: state.companyId };
    }
    const res = await createDraftDeal();
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    dispatch({
      type: "SET_DRAFT",
      dealId: res.dealId,
      companyId: res.companyId,
    });
    return { dealId: res.dealId, companyId: res.companyId };
  }, [state.dealId, state.companyId]);

  /** Upload files to storage + record rows; optionally run AI on the first. */
  const handleFiles = React.useCallback(
    async (fileList: FileList | File[], runAi: boolean) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;
      const tooBig = files.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
      if (tooBig) {
        toast.error(`Please upload contracts under ${MAX_FILE_MB}MB.`);
        return;
      }
      setBusy(true);
      const draft = await ensureDraft();
      if (!draft) {
        setBusy(false);
        return;
      }
      try {
        let firstFileId: string | null = null;
        for (const file of files) {
          const { path } = await uploadDealFile(supabase, {
            companyId: draft.companyId,
            dealId: draft.dealId,
            filename: file.name,
            file,
          });
          const rec = await recordDealFile(draft.dealId, {
            storagePath: path,
            originalFilename: file.name,
            fileSizeBytes: file.size,
            contentType: file.type || null,
          });
          if (rec.ok) {
            dispatch({
              type: "ADD_FILES",
              files: [
                {
                  id: rec.fileId,
                  name: file.name,
                  sizeBytes: file.size,
                  contentType: file.type,
                },
              ],
            });
            if (!firstFileId) firstFileId = rec.fileId;
          } else {
            toast.error(rec.error);
          }
        }

        if (runAi && firstFileId) {
          toast.info("Reading your contract with AI…");
          const resp = await fetch("/api/deals/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dealFileId: firstFileId }),
          });
          const data = await resp.json();
          if (resp.ok) {
            dispatch({
              type: "APPLY_AI",
              fields: data.fields,
              confidence: data.confidence ?? {},
            });
            toast.success(
              "AI filled in suggestions — confirm each before saving.",
            );
          } else {
            toast.error(
              data.error ??
                "AI extraction failed. Please enter details manually.",
            );
          }
          dispatch({ type: "SET_STEP", step: 2 });
        } else if (runAi) {
          dispatch({ type: "SET_STEP", step: 2 });
        }
      } catch (err) {
        console.error(err);
        toast.error("Upload failed. Please try again.");
      } finally {
        setBusy(false);
      }
    },
    [ensureDraft, supabase],
  );

  const setField = (key: keyof Fields, value: Fields[keyof Fields]) =>
    dispatch({ type: "SET_FIELD", key, value });

  const validateStep = (step: 2 | 3): boolean => {
    const payload = buildPayload(state.fields);
    const schema = step === 2 ? dealStep2Schema : dealStep3Schema;
    const result = schema.safeParse(payload);
    if (result.success) {
      dispatch({ type: "SET_ERRORS", errors: {} });
      return true;
    }
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0]);
      if (!errors[key]) errors[key] = issue.message;
    }
    dispatch({ type: "SET_ERRORS", errors });
    toast.error("Please fix the highlighted fields.");
    return false;
  };

  const goNext = () => {
    if (state.step === 2 && !validateStep(2)) return;
    if (state.step === 3 && !validateStep(3)) return;
    dispatch({
      type: "SET_STEP",
      step: Math.min(4, state.step + 1) as State["step"],
    });
  };
  const goBack = () =>
    dispatch({
      type: "SET_STEP",
      step: Math.max(1, state.step - 1) as State["step"],
    });

  const onSaveDraft = async () => {
    const draft = await ensureDraft();
    if (!draft) return;
    setBusy(true);
    const res = await saveDealDraft(draft.dealId, buildPayload(state.fields));
    setBusy(false);
    if (res.ok) {
      toast.success("Draft saved.");
      router.push("/app/deals");
    } else {
      toast.error(res.error);
    }
  };

  const onSubmit = async () => {
    if (!validateStep(2) || !validateStep(3)) {
      toast.error("Some required fields are missing.");
      return;
    }
    const draft = await ensureDraft();
    if (!draft) return;
    setBusy(true);
    const res = await submitDeal(draft.dealId, buildPayload(state.fields));
    setBusy(false);
    if (res.ok) {
      toast.success("Deal created.");
      router.push(`/app/deals/${res.dealId}`);
    } else {
      toast.error(res.error);
    }
  };

  // AI-pill helpers shared by field rows.
  const pillFor = (key: AiKey) => {
    if (!(key in state.ai)) return null;
    if (state.confirmed.has(key)) return <ConfirmedPill />;
    return (
      <AiPill
        confidence={state.ai[key]}
        onConfirm={() => dispatch({ type: "CONFIRM_FIELD", key })}
      />
    );
  };

  const unconfirmedCount = Object.keys(state.ai).filter(
    (k) => !state.confirmed.has(k),
  ).length;

  return (
    <div className="space-y-6">
      <StepIndicator step={state.step} />

      {state.files.length > 0 && state.step !== 1 ? (
        <FilesBar
          files={state.files}
          busy={busy}
          onAdd={(fl) => handleFiles(fl, false)}
          onRemove={(id) => dispatch({ type: "REMOVE_FILE", id })}
        />
      ) : null}

      {state.step === 1 ? (
        <StepStart
          busy={busy}
          onUpload={(fl) => handleFiles(fl, true)}
          onManual={() => dispatch({ type: "SET_STEP", step: 2 })}
        />
      ) : null}

      {state.step === 2 ? (
        <StepPropertyClient
          fields={state.fields}
          errors={state.errors}
          setField={setField}
          pillFor={pillFor}
        />
      ) : null}

      {state.step === 3 ? (
        <StepTerms
          fields={state.fields}
          errors={state.errors}
          setField={setField}
          pillFor={pillFor}
          agents={agents}
          dealTypes={dealTypes}
        />
      ) : null}

      {state.step === 4 ? (
        <StepReview
          fields={state.fields}
          files={state.files}
          agents={agents}
          dealTypes={dealTypes}
          unconfirmedCount={unconfirmedCount}
        />
      ) : null}

      {/* Footer nav — Save as draft available on every step. */}
      <div className="flex items-center justify-between border-t pt-4">
        <div>
          {state.step > 1 ? (
            <Button variant="ghost" onClick={goBack} disabled={busy}>
              Back
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSaveDraft} disabled={busy}>
            Save as draft
          </Button>
          {state.step < 4 && state.step > 1 ? (
            <Button onClick={goNext} disabled={busy}>
              Continue
            </Button>
          ) : null}
          {state.step === 4 ? (
            <Button onClick={onSubmit} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Create deal
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const STEPS = ["Start", "Property & client", "Deal terms", "Review"];

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {n}
            </span>
            <span
              className={cn(active ? "font-medium" : "text-muted-foreground")}
            >
              {label}
            </span>
            {n < STEPS.length ? (
              <span className="text-muted-foreground mx-1">›</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────────
function StepStart({
  busy,
  onUpload,
  onManual,
}: {
  busy: boolean;
  onUpload: (files: FileList) => void;
  onManual: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* A — upload (AI extract) */}
        <Card
          className={cn(
            "border-2 border-dashed transition-colors",
            dragging ? "border-primary bg-primary/5" : "",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) onUpload(e.dataTransfer.files);
          }}
        >
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
              {busy ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Upload className="size-6" />
              )}
            </div>
            <div>
              <p className="font-medium">Upload contract — AI extracts data</p>
              <p className="text-muted-foreground text-sm">
                Drag &amp; drop or click. PDF or image, multiple files OK.
              </p>
            </div>
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              variant="default"
            >
              Choose files
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
          </CardContent>
        </Card>

        {/* B — manual */}
        <Card className="border-2">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              <FileText className="size-6" />
            </div>
            <div>
              <p className="font-medium">Enter manually</p>
              <p className="text-muted-foreground text-sm">
                Skip the upload and type the details yourself.
              </p>
            </div>
            <Button variant="outline" onClick={onManual} disabled={busy}>
              Enter manually
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Extraction guidance */}
      <p className="text-muted-foreground text-xs">
        AI extraction works best on clear, recently-signed contracts. For older
        documents or poor scans, please enter details manually.
      </p>

      {/* Privacy note (audit F-079) */}
      <p className="text-muted-foreground text-xs">
        Contracts are processed by our AI to pre-fill the form. Files are stored
        in your team&apos;s account and not shared externally.{" "}
        <a
          href="/privacy"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          View our Privacy Policy →
        </a>
      </p>
    </div>
  );
}

function FilesBar({
  files,
  busy,
  onAdd,
  onRemove,
}: {
  files: DealFileMeta[];
  busy: boolean;
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-md border p-3">
      <span className="text-muted-foreground text-xs font-medium">
        Files ({files.length}):
      </span>
      {files.map((f) => (
        <span
          key={f.id}
          className="bg-background inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
        >
          <FileText className="size-3" />
          <span className="max-w-[12rem] truncate">{f.name}</span>
          <span className="text-muted-foreground">
            ({formatBytes(f.sizeBytes)})
          </span>
          <button
            type="button"
            onClick={() => onRemove(f.id)}
            aria-label={`Remove ${f.name} from this view`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Button
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        + Add files
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onAdd(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
function StepPropertyClient({
  fields,
  errors,
  setField,
  pillFor,
}: {
  fields: Fields;
  errors: Record<string, string>;
  setField: (key: keyof Fields, value: Fields[keyof Fields]) => void;
  pillFor: (key: AiKey) => React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Property</h2>
        <div>
          <FieldLabel htmlFor="property_address" required>
            Property address
          </FieldLabel>
          <Input
            id="property_address"
            value={fields.property_address}
            placeholder="123 Maple St"
            onChange={(e) => setField("property_address", e.target.value)}
          />
          {pillFor("property_address")}
          <FieldError>{errors.property_address}</FieldError>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor="property_city" optional>
              City
            </FieldLabel>
            <Input
              id="property_city"
              value={fields.property_city}
              placeholder="Pasadena"
              onChange={(e) => setField("property_city", e.target.value)}
            />
            {pillFor("property_city")}
          </div>
          <div>
            <FieldLabel htmlFor="property_state" optional>
              State
            </FieldLabel>
            <Input
              id="property_state"
              maxLength={2}
              value={fields.property_state}
              placeholder="CA"
              onChange={(e) =>
                setField("property_state", e.target.value.toUpperCase())
              }
            />
            {pillFor("property_state")}
          </div>
          <div>
            <FieldLabel htmlFor="property_zip" optional>
              ZIP
            </FieldLabel>
            <Input
              id="property_zip"
              value={fields.property_zip}
              placeholder="91101"
              onChange={(e) => setField("property_zip", e.target.value)}
            />
            {pillFor("property_zip")}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Client</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="client_first_name" required>
              First name
            </FieldLabel>
            <Input
              id="client_first_name"
              value={fields.client_first_name}
              placeholder="Dana"
              onChange={(e) => setField("client_first_name", e.target.value)}
            />
            {pillFor("client_first_name")}
            <FieldError>{errors.client_first_name}</FieldError>
          </div>
          <div>
            <FieldLabel htmlFor="client_last_name" required>
              Last name
            </FieldLabel>
            <Input
              id="client_last_name"
              value={fields.client_last_name}
              placeholder="Reed"
              onChange={(e) => setField("client_last_name", e.target.value)}
            />
            {pillFor("client_last_name")}
            <FieldError>{errors.client_last_name}</FieldError>
          </div>
          <div>
            <FieldLabel htmlFor="client_email" optional>
              Email
            </FieldLabel>
            <Input
              id="client_email"
              type="email"
              value={fields.client_email}
              placeholder="dana@example.com"
              onChange={(e) => setField("client_email", e.target.value)}
            />
            {pillFor("client_email")}
            <FieldError>{errors.client_email}</FieldError>
          </div>
          <div>
            <FieldLabel htmlFor="client_phone" optional>
              Phone
            </FieldLabel>
            <Input
              id="client_phone"
              value={fields.client_phone}
              placeholder="(555) 123-4567"
              onChange={(e) => setField("client_phone", e.target.value)}
            />
            {pillFor("client_phone")}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <FieldLabel required>Representing</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {(["buyer", "seller", "dual"] as Representing[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setField("representing", r)}
              className={cn(
                "rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                fields.representing === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "hover:bg-muted",
              )}
            >
              {REPRESENTING_LABELS[r]}
            </button>
          ))}
        </div>
        {pillFor("representing")}
        <FieldError>{errors.representing}</FieldError>
      </section>
    </div>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────────────
function AgentSelect({
  id,
  value,
  onChange,
  agents,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  agents: AgentOption[];
  placeholder: string;
}) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(v) => onChange(v === "none" ? "" : v)}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Unassigned</SelectItem>
        {agents.map((a) => (
          <SelectItem key={a.id} value={a.id}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ContingencyRow({
  id,
  label,
  value,
  onChange,
  rpaDate,
  verb,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  rpaDate: string;
  verb: string;
}) {
  const clears = contingencyClearsLabel(rpaDate, value);
  return (
    <div>
      <FieldLabel htmlFor={id} optional>
        {label} (days)
      </FieldLabel>
      <IntegerInput
        id={id}
        value={value}
        onChange={onChange}
        placeholder="17"
      />
      {clears ? (
        <p className="text-muted-foreground mt-1 text-xs">
          {verb} clears on {clears}
        </p>
      ) : null}
    </div>
  );
}

function StepTerms({
  fields,
  errors,
  setField,
  pillFor,
  agents,
  dealTypes,
}: {
  fields: Fields;
  errors: Record<string, string>;
  setField: (key: keyof Fields, value: Fields[keyof Fields]) => void;
  pillFor: (key: AiKey) => React.ReactNode;
  agents: AgentOption[];
  dealTypes: { id: string; name: string }[];
}) {
  const rep = fields.representing;
  const showListing = rep === "seller" || rep === "dual";
  const showBuyer = rep === "buyer" || rep === "dual";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="rpa_signed_date" required>
            RPA signed date
          </FieldLabel>
          <Input
            id="rpa_signed_date"
            type="date"
            value={fields.rpa_signed_date}
            onChange={(e) => setField("rpa_signed_date", e.target.value)}
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Anchors all contingency dates below.
          </p>
          {pillFor("rpa_signed_date")}
          <FieldError>{errors.rpa_signed_date}</FieldError>
        </div>
        <div>
          <FieldLabel htmlFor="close_date" optional>
            Close date
          </FieldLabel>
          <Input
            id="close_date"
            type="date"
            value={fields.close_date}
            onChange={(e) => setField("close_date", e.target.value)}
          />
          {pillFor("close_date")}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <FieldLabel htmlFor="sales_price" optional>
            Sales price
          </FieldLabel>
          <CurrencyInput
            id="sales_price"
            value={fields.sales_price_cents}
            onChange={(c) => setField("sales_price_cents", c)}
            placeholder="650,000"
          />
          {pillFor("sales_price_cents")}
        </div>
        <div>
          <FieldLabel htmlFor="commission_pct" optional>
            Commission %
          </FieldLabel>
          <DecimalInput
            id="commission_pct"
            value={fields.commission_pct}
            onChange={(n) => setField("commission_pct", n)}
            placeholder="2.5"
            suffix="%"
            max={100}
          />
        </div>
        <div>
          <FieldLabel htmlFor="gci" optional>
            GCI
          </FieldLabel>
          <CurrencyInput
            id="gci"
            value={fields.gci_cents}
            onChange={(c) => setField("gci_cents", c)}
            placeholder="19,500"
          />
          <p className="text-muted-foreground mt-1 text-xs">
            Auto-calculated from price × commission; editable.
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Contingencies</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <ContingencyRow
            id="inspection_contingency_days"
            label="Inspection"
            verb="Inspection"
            value={fields.inspection_contingency_days}
            onChange={(n) => setField("inspection_contingency_days", n)}
            rpaDate={fields.rpa_signed_date}
          />
          <ContingencyRow
            id="appraisal_contingency_days"
            label="Appraisal"
            verb="Appraisal"
            value={fields.appraisal_contingency_days}
            onChange={(n) => setField("appraisal_contingency_days", n)}
            rpaDate={fields.rpa_signed_date}
          />
          <ContingencyRow
            id="loan_contingency_days"
            label="Loan"
            verb="Loan"
            value={fields.loan_contingency_days}
            onChange={(n) => setField("loan_contingency_days", n)}
            rpaDate={fields.rpa_signed_date}
          />
        </div>
      </section>

      {dealTypes.length > 0 ? (
        <div className="max-w-xs">
          <FieldLabel htmlFor="deal_type" optional>
            Deal type
          </FieldLabel>
          <Select
            value={fields.deal_type_id || "none"}
            onValueChange={(v) =>
              setField("deal_type_id", v === "none" ? "" : v)
            }
          >
            <SelectTrigger id="deal_type">
              <SelectValue placeholder="Select a type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {dealTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Conditional agent/broker fields by representing (audit F-081). */}
      {rep === "" ? (
        <p className="text-muted-foreground text-sm">
          Choose who you&apos;re representing on the previous step to see the
          relevant agent and broker fields.
        </p>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2">
          {showListing ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Listing side</h3>
              <div>
                <FieldLabel htmlFor="listing_agent" optional>
                  Listing agent
                </FieldLabel>
                <AgentSelect
                  id="listing_agent"
                  value={fields.listing_agent_id}
                  onChange={(v) => setField("listing_agent_id", v)}
                  agents={agents}
                  placeholder="Select an agent"
                />
              </div>
              <div>
                <FieldLabel htmlFor="co_listing_agent" optional>
                  Co-listing agent
                </FieldLabel>
                <AgentSelect
                  id="co_listing_agent"
                  value={fields.co_listing_agent_id}
                  onChange={(v) => setField("co_listing_agent_id", v)}
                  agents={agents}
                  placeholder="Select an agent"
                />
              </div>
              <div>
                <FieldLabel htmlFor="listing_broker" optional>
                  Listing broker
                </FieldLabel>
                <Input
                  id="listing_broker"
                  value={fields.listing_broker}
                  placeholder="Coldwell Banker"
                  onChange={(e) => setField("listing_broker", e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {showBuyer ? (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Buyer side</h3>
              <div>
                <FieldLabel htmlFor="buyer_agent" optional>
                  Buyer&apos;s agent
                </FieldLabel>
                <AgentSelect
                  id="buyer_agent"
                  value={fields.buyer_agent_id}
                  onChange={(v) => setField("buyer_agent_id", v)}
                  agents={agents}
                  placeholder="Select an agent"
                />
              </div>
              <div>
                <FieldLabel htmlFor="buy_side_broker" optional>
                  Buy-side broker
                </FieldLabel>
                <Input
                  id="buy_side_broker"
                  value={fields.buy_side_broker}
                  placeholder="Keller Williams"
                  onChange={(e) => setField("buy_side_broker", e.target.value)}
                />
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

// ── Step 4 ────────────────────────────────────────────────────────────────────
function ReviewRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function StepReview({
  fields,
  files,
  agents,
  dealTypes,
  unconfirmedCount,
}: {
  fields: Fields;
  files: DealFileMeta[];
  agents: AgentOption[];
  dealTypes: { id: string; name: string }[];
  unconfirmedCount: number;
}) {
  const agentName = (id: string) =>
    agents.find((a) => a.id === id)?.name ?? null;
  const typeName = dealTypes.find((t) => t.id === fields.deal_type_id)?.name;

  return (
    <div className="space-y-6">
      {unconfirmedCount > 0 ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {unconfirmedCount} AI-suggested{" "}
          {unconfirmedCount === 1 ? "value is" : "values are"} still
          unconfirmed. Go back and confirm each, or edit them, before creating
          the deal.
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardContent className="py-4">
            <h3 className="mb-2 text-sm font-semibold">Property</h3>
            <ReviewRow label="Address" value={fields.property_address} />
            <ReviewRow
              label="City / State / ZIP"
              value={[
                fields.property_city,
                fields.property_state,
                fields.property_zip,
              ]
                .filter(Boolean)
                .join(", ")}
            />
            <ReviewRow
              label="Representing"
              value={
                fields.representing
                  ? REPRESENTING_LABELS[fields.representing]
                  : null
              }
            />
            <ReviewRow label="Deal type" value={typeName} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <h3 className="mb-2 text-sm font-semibold">Client</h3>
            <ReviewRow
              label="Name"
              value={clientName(
                fields.client_first_name,
                fields.client_last_name,
              )}
            />
            <ReviewRow label="Email" value={fields.client_email} />
            <ReviewRow label="Phone" value={fields.client_phone} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <h3 className="mb-2 text-sm font-semibold">Terms</h3>
            <ReviewRow
              label="RPA signed"
              value={
                fields.rpa_signed_date
                  ? formatDate(fields.rpa_signed_date, "short")
                  : null
              }
            />
            <ReviewRow
              label="Sales price"
              value={
                fields.sales_price_cents != null
                  ? formatCurrency(fields.sales_price_cents)
                  : null
              }
            />
            <ReviewRow
              label="Commission"
              value={
                fields.commission_pct != null
                  ? `${fields.commission_pct}%`
                  : null
              }
            />
            <ReviewRow
              label="GCI"
              value={
                fields.gci_cents != null
                  ? formatCurrency(fields.gci_cents)
                  : null
              }
            />
            <ReviewRow
              label="Close date"
              value={
                fields.close_date
                  ? formatDate(fields.close_date, "short")
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <h3 className="mb-2 text-sm font-semibold">Contingencies</h3>
            <ReviewRow
              label="Inspection"
              value={
                fields.inspection_contingency_days != null
                  ? `${fields.inspection_contingency_days} days · ${
                      contingencyClearsLabel(
                        fields.rpa_signed_date,
                        fields.inspection_contingency_days,
                      ) ?? "—"
                    }`
                  : null
              }
            />
            <ReviewRow
              label="Appraisal"
              value={
                fields.appraisal_contingency_days != null
                  ? `${fields.appraisal_contingency_days} days`
                  : null
              }
            />
            <ReviewRow
              label="Loan"
              value={
                fields.loan_contingency_days != null
                  ? `${fields.loan_contingency_days} days`
                  : null
              }
            />
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardContent className="py-4">
            <h3 className="mb-2 text-sm font-semibold">Agents & brokers</h3>
            <ReviewRow
              label="Listing agent"
              value={agentName(fields.listing_agent_id)}
            />
            <ReviewRow
              label="Co-listing agent"
              value={agentName(fields.co_listing_agent_id)}
            />
            <ReviewRow
              label="Buyer's agent"
              value={agentName(fields.buyer_agent_id)}
            />
            <ReviewRow label="Listing broker" value={fields.listing_broker} />
            <ReviewRow label="Buy-side broker" value={fields.buy_side_broker} />
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardContent className="py-4">
            <h3 className="mb-2 text-sm font-semibold">
              Files ({files.length})
            </h3>
            {files.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No files attached.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <FileText className="size-4" />
                    {f.name}{" "}
                    <span className="text-muted-foreground">
                      ({formatBytes(f.sizeBytes)})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
