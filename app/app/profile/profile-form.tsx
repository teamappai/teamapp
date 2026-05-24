"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { profileSchema, type ProfileInput } from "@/lib/validations/auth";
import {
  showsBrokerageInfo,
  showsLicenseField,
  licenseRequired,
  type UserRole,
} from "@/lib/constants/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { updateProfile } from "./actions";

export function ProfileForm({
  role,
  defaults,
  brokerageName,
  brokerageState,
}: {
  role: UserRole;
  defaults: ProfileInput;
  brokerageName: string | null;
  brokerageState: string | null;
}) {
  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema(role)),
    defaultValues: {
      fullName: defaults.fullName ?? "",
      email: defaults.email ?? "",
      phone: defaults.phone ?? "",
      ...(showsLicenseField(role)
        ? { licenseNumber: defaults.licenseNumber ?? "" }
        : {}),
    },
  });

  const emailChanged =
    form.watch("email").trim().toLowerCase() !==
    (defaults.email ?? "").trim().toLowerCase();

  async function onSubmit(values: ProfileInput) {
    const result = await updateProfile(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.emailChangePending) {
      toast.success("Saved. Check your new inbox to confirm the email change.");
    } else {
      toast.success("Profile saved");
    }
    // Reset the baseline so the form is no longer dirty (hides the save bar).
    form.reset(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input autoComplete="name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              {emailChanged ? (
                <FormDescription>
                  Changing your email will send a verification link to the new
                  address. You&apos;ll remain signed in with the old email until
                  verified.
                </FormDescription>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  autoComplete="tel"
                  placeholder="(555) 555-5555"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {showsLicenseField(role) ? (
          <FormField
            control={form.control}
            name="licenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  License number
                  {licenseRequired(role) ? null : " (optional)"}
                </FormLabel>
                <FormControl>
                  <Input placeholder="DRE #01234567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        {showsBrokerageInfo(role) ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <FormLabel>Brokerage name</FormLabel>
              <Input value={brokerageName ?? "—"} readOnly disabled />
            </div>
            <div className="space-y-1">
              <FormLabel>Brokerage state</FormLabel>
              <Input value={brokerageState ?? "—"} readOnly disabled />
            </div>
            <p className="text-muted-foreground text-xs">
              Managed by your team lead.
            </p>
          </div>
        ) : null}

        {form.formState.isDirty ? (
          <div className="bg-background/95 sticky bottom-0 -mx-6 flex items-center justify-end gap-3 border-t px-6 py-3 backdrop-blur">
            <p className="text-muted-foreground mr-auto text-sm">
              You have unsaved changes.
            </p>
            <Button
              type="button"
              variant="ghost"
              onClick={() => form.reset()}
              disabled={form.formState.isSubmitting}
            >
              Discard
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        ) : null}
      </form>
    </Form>
  );
}
