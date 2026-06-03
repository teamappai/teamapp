"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { signIn } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [mfa, setMfa] = useState<{ redirectTo: string } | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    const result = await signIn({ ...values, next });
    if (!result.ok) {
      form.setError("password", { message: result.error });
      return;
    }
    if ("mfaRequired" in result) {
      setMfa({ redirectTo: result.redirectTo });
      return;
    }
    router.replace(result.redirectTo);
    router.refresh();
  }

  if (mfa) {
    return (
      <MfaChallenge
        redirectTo={mfa.redirectTo}
        onVerified={(to) => {
          router.replace(to);
          router.refresh();
        }}
      />
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="you@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <a
                  href="/forgot-password"
                  className="text-muted-foreground hover:text-foreground text-sm"
                >
                  Forgot password?
                </a>
              </div>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </Form>
  );
}

function MfaChallenge({
  redirectTo,
  onVerified,
}: {
  redirectTo: string;
  onVerified: (to: string) => void;
}) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setPending(true);
    const supabase = createClient();
    const { data: factors, error: listErr } =
      await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.[0];
    if (listErr || !factor) {
      setError("Could not find your authenticator. Try logging in again.");
      setPending(false);
      return;
    }
    const { data: challenge, error: challengeErr } =
      await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeErr || !challenge) {
      setError("Could not start verification. Try again.");
      setPending(false);
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code,
    });
    if (verifyErr) {
      setError("That code didn't match. Try again.");
      setPending(false);
      return;
    }
    toast.success("Verified");
    onVerified(redirectTo);
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="mfa-code" className="text-sm font-medium">
          Two-factor code
        </label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          autoFocus
        />
        <p className="text-muted-foreground text-sm">
          Enter the 6-digit code from your authenticator app.
        </p>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : "Verify"}
      </Button>
    </form>
  );
}
