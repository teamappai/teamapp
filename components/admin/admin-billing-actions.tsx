"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, BadgeDollarSign, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  extendTrialDays,
  applyCreditToCompany,
  forceSuspendCompany,
} from "@/app/app/admin/actions";

/**
 * Super-admin billing overrides (Decision 11 — C, limited override). Every
 * action is audit-logged server-side. Plan/payment changes are NOT here — those
 * go through the team-lead UI or the Stripe Dashboard.
 */
export function AdminBillingActions({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [creditOpen, setCreditOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");

  async function run(
    fn: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ) {
    setPending(true);
    const res = await fn();
    setPending(false);
    if (res.ok) {
      toast.success(res.message ?? "Done.");
      router.refresh();
      return true;
    }
    toast.error(res.error ?? "Something went wrong.");
    return false;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(() => extendTrialDays(companyId, 30))}
      >
        <CalendarPlus className="size-4" /> Extend trial 30 days
      </Button>

      <Button variant="outline" size="sm" onClick={() => setCreditOpen(true)}>
        <BadgeDollarSign className="size-4" /> Apply credit
      </Button>

      <Button variant="outline" size="sm" onClick={() => setSuspendOpen(true)}>
        <ShieldAlert className="size-4" /> Force suspend
      </Button>

      {/* Apply credit */}
      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply credit</DialogTitle>
            <DialogDescription>
              Adds account credit in Stripe (applied to future invoices).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="credit-amount">Amount (USD)</Label>
              <Input
                id="credit-amount"
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="credit-reason">Reason</Label>
              <Input
                id="credit-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Service credit for downtime"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCreditOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={async () => {
                const cents = Math.round(parseFloat(amount || "0") * 100);
                const ok = await run(() =>
                  applyCreditToCompany(companyId, cents, reason),
                );
                if (ok) {
                  setCreditOpen(false);
                  setAmount("");
                  setReason("");
                }
              }}
            >
              Apply credit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force suspend */}
      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Force suspend company</DialogTitle>
            <DialogDescription>
              Emergency action. Blocks app access for everyone in this company
              (except the billing page). Use for terms violations or non-payment
              escalation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setSuspendOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={async () => {
                const ok = await run(() => forceSuspendCompany(companyId));
                if (ok) setSuspendOpen(false);
              }}
            >
              Suspend company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
