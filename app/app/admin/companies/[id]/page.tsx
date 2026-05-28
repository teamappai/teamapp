import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getCompanyDetail } from "@/lib/admin/companies";
import { listCompanyActivity } from "@/lib/admin/audit";
import { getPlan } from "@/lib/billing/plans";
import { formatDate } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/shared/status-chip";
import { CompanyDetailTabs } from "@/components/admin/company-detail-tabs";

export const metadata: Metadata = { title: "Company · TeamApp" };

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const [detail, activity] = await Promise.all([
    getCompanyDetail(id),
    listCompanyActivity(id),
  ]);
  if (!detail) notFound();

  const { company } = detail;

  return (
    <div className="space-y-6">
      <Link
        href="/app/admin/companies"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Companies
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <div className="bg-muted flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          {company.logo_url ? (
            <Image
              src={company.logo_url}
              alt={company.name}
              width={48}
              height={48}
              className="size-12 object-contain"
            />
          ) : (
            <Building2 className="text-muted-foreground size-6" />
          )}
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {company.name}
            </h1>
            <Badge variant="secondary">
              {getPlan(company.plan).display_name}
            </Badge>
            <StatusChip domain="company" status={company.status} />
          </div>
          <p className="text-muted-foreground text-sm">
            Signed up {formatDate(company.created_at, "short")}
          </p>
        </div>
      </div>

      <CompanyDetailTabs detail={detail} activity={activity} />
    </div>
  );
}
