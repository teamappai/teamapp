import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getUserDetail } from "@/lib/admin/users";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/format";
import { Card, CardContent } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { ImpersonateButton } from "@/components/admin/impersonate-button";

export const metadata: Metadata = { title: "User · TeamApp" };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdmin();
  const { id } = await params;

  const detail = await getUserDetail(id);
  if (!detail) notFound();

  const { user, companyName, activity } = detail;
  const name = user.full_name ?? user.email;
  const canImpersonate = user.role !== "super_admin";

  return (
    <div className="space-y-6">
      <Link
        href="/app/admin/users"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Users
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar
            name={user.full_name}
            src={user.avatar_url}
            seed={user.id}
            size="lg"
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
              <StatusChip domain="user" status={user.status} />
            </div>
            <p className="text-muted-foreground text-sm">{user.email}</p>
          </div>
        </div>
        {canImpersonate ? (
          <ImpersonateButton userId={user.id} userName={name} />
        ) : null}
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <Field label="Role" value={ROLE_LABELS[user.role]} />
          <Field label="Company" value={companyName ?? "—"} />
          <Field
            label="Status"
            value={<StatusChip domain="user" status={user.status} />}
          />
          <Field label="Phone" value={user.phone ?? "—"} />
          <Field label="License" value={user.license_number ?? "—"} />
          <Field
            label="Last active"
            value={
              user.last_active_at
                ? formatDate(user.last_active_at, "relative")
                : "—"
            }
          />
          <Field label="Joined" value={formatDate(user.created_at, "short")} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        {activity.length === 0 ? (
          <EmptyState title="No recent activity for this user." />
        ) : (
          <ul className="divide-border divide-y rounded-lg border">
            {activity.map((a, i) => (
              <li
                key={`${a.kind}-${i}`}
                className="flex items-center justify-between gap-3 p-3 text-sm"
              >
                <span>{a.label}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatDate(a.at, "relative")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
