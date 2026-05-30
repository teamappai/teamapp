"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils/index";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Shared field widgets for the deal wizard.
 *
 * Consistency rules the audit pinned:
 *  - Required fields get a red asterisk; optional fields get a "(Optional)"
 *    suffix. Never "(If Available)" (F-083).
 *  - Placeholders give a format hint, never echo the label (F-084 / F-085).
 *  - AI-suggested values render a pill the user must confirm; low-confidence
 *    suggestions are greyed and must be edited or explicitly confirmed (SR-1).
 */

export function FieldLabel({
  htmlFor,
  children,
  required,
  optional,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-sm">
      {children}
      {required ? (
        <span className="text-destructive ml-0.5" aria-hidden>
          *
        </span>
      ) : null}
      {optional ? (
        <span className="text-muted-foreground ml-1 text-xs font-normal">
          (Optional)
        </span>
      ) : null}
    </Label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-destructive mt-1 text-xs">{children}</p>;
}

/**
 * The "AI-suggested" pill. Clicking it confirms the value (audit SR-1 — values
 * are never auto-applied without explicit user action). Low-confidence
 * suggestions render greyed with an explicit warning.
 */
export function AiPill({
  confidence,
  onConfirm,
}: {
  confidence?: number;
  onConfirm: () => void;
}) {
  const low = confidence != null && confidence < 0.7;
  return (
    <button
      type="button"
      onClick={onConfirm}
      className={cn(
        "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
        low
          ? "bg-muted text-muted-foreground hover:bg-muted/70"
          : "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300",
      )}
      title="Click to confirm this AI-suggested value"
    >
      <Sparkles className="size-3" aria-hidden />
      {low ? "AI-suggested (low confidence)" : "AI-suggested"}
      <Check className="size-3 opacity-70" aria-hidden />
    </button>
  );
}

/** Confirmed indicator shown after the user accepts/edits an AI suggestion. */
export function ConfirmedPill() {
  return (
    <span className="text-muted-foreground mt-1 inline-flex items-center gap-1 text-xs">
      <Check className="size-3 text-emerald-600" aria-hidden />
      Confirmed
    </span>
  );
}

// ── currency input (whole-dollar entry, stored as cents) ──────────────────────
function centsToText(cents: number | null): string {
  if (cents == null) return "";
  return Math.round(cents / 100).toLocaleString("en-US");
}

export function CurrencyInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: number | null;
  onChange: (cents: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
        $
      </span>
      <Input
        id={id}
        inputMode="numeric"
        className="pl-6"
        value={centsToText(value)}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          onChange(digits ? Number(digits) * 100 : null);
        }}
      />
    </div>
  );
}

/** Integer number input (e.g. contingency days, commission %). */
export function IntegerInput({
  id,
  value,
  onChange,
  placeholder,
  min = 0,
  suffix,
}: {
  id?: string;
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        min={min}
        step={1}
        className={suffix ? "pr-8" : undefined}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Math.trunc(Number(v)));
        }}
      />
      {suffix ? (
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Decimal number input (e.g. commission %, which is 2.5 / 2.75 / 3 — decimals
 * are required; the column is NUMERIC(5,3)). Rounds to 3 decimal places.
 */
export function DecimalInput({
  id,
  value,
  onChange,
  placeholder,
  suffix,
  min = 0,
  max,
  step = "0.01",
}: {
  id?: string;
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        className={suffix ? "pr-8" : undefined}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") {
            onChange(null);
            return;
          }
          const n = Number(v);
          onChange(Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null);
        }}
      />
      {suffix ? (
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
