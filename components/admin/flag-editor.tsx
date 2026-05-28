"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils/index";
import { setFlagGlobal, setFlagCompanies } from "@/app/app/admin/actions";
import type { FeatureFlag, CompanyOption } from "@/lib/admin/flags";

type FlagState = {
  enabled_globally: boolean;
  enabled_company_ids: string[];
};

export function FlagEditor({
  flags,
  companies,
}: {
  flags: FeatureFlag[];
  companies: CompanyOption[];
}) {
  return (
    <div className="space-y-3">
      {flags.map((flag) => (
        <FlagRow key={flag.key} flag={flag} companies={companies} />
      ))}
    </div>
  );
}

function FlagRow({
  flag,
  companies,
}: {
  flag: FeatureFlag;
  companies: CompanyOption[];
}) {
  const [state, setState] = React.useState<FlagState>({
    enabled_globally: flag.enabled_globally,
    enabled_company_ids: flag.enabled_company_ids ?? [],
  });
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function toggleGlobal(next: boolean) {
    const prev = state.enabled_globally;
    setState((s) => ({ ...s, enabled_globally: next }));
    startTransition(async () => {
      const res = await setFlagGlobal(flag.key, next);
      if (!res.ok) {
        setState((s) => ({ ...s, enabled_globally: prev }));
        toast.error(res.error);
      } else {
        toast.success(`${flag.key} ${next ? "enabled" : "disabled"} globally`);
      }
    });
  }

  function toggleCompany(companyId: string, checked: boolean) {
    const prev = state.enabled_company_ids;
    const next = checked
      ? [...prev, companyId]
      : prev.filter((id) => id !== companyId);
    setState((s) => ({ ...s, enabled_company_ids: next }));
    startTransition(async () => {
      const res = await setFlagCompanies(flag.key, next);
      if (!res.ok) {
        setState((s) => ({ ...s, enabled_company_ids: prev }));
        toast.error(res.error);
      } else {
        toast.success("Per-company override updated");
      }
    });
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="font-mono text-sm font-medium">{flag.key}</p>
            {flag.description ? (
              <p className="text-muted-foreground text-sm">
                {flag.description}
              </p>
            ) : null}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <span className="text-muted-foreground">Global</span>
            <Switch
              checked={state.enabled_globally}
              onCheckedChange={toggleGlobal}
              disabled={pending}
              aria-label={`Enable ${flag.key} globally`}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
          Per-company override
          {state.enabled_company_ids.length
            ? ` (${state.enabled_company_ids.length})`
            : ""}
        </button>

        {open ? (
          companies.length ? (
            <div className="grid gap-2 border-t pt-3 sm:grid-cols-2">
              {companies.map((c) => {
                const checked = state.enabled_company_ids.includes(c.id);
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleCompany(c.id, v === true)}
                      disabled={pending}
                    />
                    <span>{c.name}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground border-t pt-3 text-xs">
              No companies yet.
            </p>
          )
        ) : null}

        {state.enabled_globally ? (
          <p className="text-muted-foreground text-xs">
            Enabled globally — per-company overrides are ignored while this is
            on.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
