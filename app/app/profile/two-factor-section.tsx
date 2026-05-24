"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Enrolling = { factorId: string; qr: string; secret: string };

export function TwoFactorSection({
  required = false,
  redirectOnEnroll,
}: {
  required?: boolean;
  redirectOnEnroll?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [hasFactor, setHasFactor] = useState(false);
  const [enrolling, setEnrolling] = useState<Enrolling | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFactors = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setHasFactor((data?.totp?.length ?? 0) > 0);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void refreshFactors();
  }, [refreshFactors]);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    // Clear any half-finished (unverified) factor so enroll doesn't collide.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.factor_type === "totp" && f.status === "unverified") {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `TeamApp ${Date.now()}`,
    });
    setBusy(false);
    if (enrollErr || !data) {
      setError("Could not start 2FA setup. Try again.");
      return;
    }
    setEnrolling({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    const { data: challenge, error: challengeErr } =
      await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (challengeErr || !challenge) {
      setBusy(false);
      setError("Could not verify. Try again.");
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: challenge.id,
      code,
    });
    setBusy(false);
    if (verifyErr) {
      setError("That code didn't match. Try again.");
      return;
    }
    toast.success("Two-factor authentication enabled");
    setEnrolling(null);
    setCode("");
    await refreshFactors();
    if (redirectOnEnroll) {
      router.replace(redirectOnEnroll);
    }
    router.refresh();
  }

  async function disable() {
    setBusy(true);
    const { data } = await supabase.auth.mfa.listFactors();
    for (const f of data?.totp ?? []) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    setBusy(false);
    toast.success("Two-factor authentication disabled");
    await refreshFactors();
    router.refresh();
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Checking status…
      </div>
    );
  }

  if (enrolling) {
    return (
      <form onSubmit={verifyEnroll} className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Scan this QR code with your authenticator app (e.g. 1Password, Google
          Authenticator), then enter the 6-digit code to confirm.
        </p>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enrolling.qr}
            alt="2FA QR code"
            className="size-40 rounded-md border bg-white p-2"
          />
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">
              Or enter this secret manually:
            </p>
            <code className="bg-muted block rounded px-2 py-1 text-xs break-all">
              {enrolling.secret}
            </code>
          </div>
        </div>
        <div className="space-y-2">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Confirm"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setEnrolling(null);
              setCode("");
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (hasFactor) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
          <ShieldCheck className="size-4" />
          Two-factor authentication is on.
        </div>
        {required ? (
          <p className="text-muted-foreground text-sm">
            2FA is required for your account and can&apos;t be turned off.
          </p>
        ) : (
          <Button variant="outline" size="sm" onClick={disable} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Disable 2FA"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {required ? (
        <Alert>
          <AlertDescription>
            Two-factor authentication is required for your account. Set it up
            now to continue.
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-muted-foreground text-sm">
          Add an extra layer of security with an authenticator app.
        </p>
      )}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button onClick={startEnroll} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Enable 2FA"}
      </Button>
    </div>
  );
}
