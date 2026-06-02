"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils/index";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { InvoiceSummary } from "@/lib/billing/state";
import type { BillingData } from "./billing-tabs";
import { fetchInvoicesPage, exportInvoicesCsv } from "./actions";

const STATUS_PILL: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  open: "bg-amber-100 text-amber-800",
  draft: "bg-slate-100 text-slate-700",
  uncollectible: "bg-red-100 text-red-800",
  void: "bg-slate-100 text-slate-700",
};

function statusLabel(status: string): string {
  if (status === "uncollectible") return "Failed";
  if (status === "open") return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function HistoryTab({ data }: { data: BillingData }) {
  const [invoices, setInvoices] = React.useState<InvoiceSummary[]>(
    data.invoices,
  );
  const [hasMore, setHasMore] = React.useState(data.invoicesHasMore);
  const [loading, setLoading] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  async function loadMore() {
    setLoading(true);
    const last = invoices[invoices.length - 1];
    const res = await fetchInvoicesPage(last?.id);
    setLoading(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setInvoices((prev) => [...prev, ...res.invoices]);
    setHasMore(res.hasMore);
  }

  async function exportCsv() {
    setExporting(true);
    const res = await exportInvoicesCsv();
    setExporting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const blob = new Blob([res.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teamapp-invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (invoices.length === 0) {
    return (
      <EmptyState
        title="No invoices yet."
        description="Invoices appear here after your first payment."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={exporting}
        >
          <Download className="size-4" />
          {exporting ? "Exporting…" : "Export all to CSV"}
        </Button>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>
                  {formatDate(
                    new Date(inv.created * 1000).toISOString(),
                    "short",
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {inv.number ?? "—"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(inv.amountCents)}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_PILL[inv.status] ?? "bg-slate-100 text-slate-700",
                    )}
                  >
                    {statusLabel(inv.status)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {inv.pdfUrl ? (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline"
                    >
                      <Download className="size-3.5" /> PDF
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
