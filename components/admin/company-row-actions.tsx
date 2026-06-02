"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Ban,
  Eye,
  MoreHorizontal,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  suspendCompany,
  cancelCompany,
  restoreCompany,
  resendInvite,
  type AdminActionResult,
} from "@/app/app/admin/actions";

type CompanyStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "paused"
  | "cancellation_scheduled"
  | "suspended";

export function CompanyRowActions({
  companyId,
  companyName,
  status,
}: {
  companyId: string;
  companyName: string;
  status: CompanyStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(
    action: () => Promise<AdminActionResult>,
    confirmMessage?: string,
  ) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Done");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const isInactive = status === "canceled" || status === "paused";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={`Actions for ${companyName}`}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem
          onSelect={() => router.push(`/app/admin/companies/${companyId}`)}
        >
          <Eye className="size-4" /> View
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run(() => resendInvite(companyId))}>
          <Send className="size-4" /> Resend invite
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isInactive ? (
          <DropdownMenuItem
            onSelect={() =>
              run(
                () => restoreCompany(companyId),
                `Restore ${companyName} to active?`,
              )
            }
          >
            <RotateCcw className="size-4" /> Restore
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem
              onSelect={() =>
                run(
                  () => suspendCompany(companyId),
                  `Suspend ${companyName}? Members lose access until restored.`,
                )
              }
            >
              <Ban className="size-4" /> Suspend
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                run(
                  () => cancelCompany(companyId),
                  `Cancel ${companyName}'s subscription? This sets the account to canceled.`,
                )
              }
            >
              <XCircle className="size-4" /> Cancel
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
