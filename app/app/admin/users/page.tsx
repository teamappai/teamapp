import type { Metadata } from "next";
import Link from "next/link";
import { Users as UsersIcon } from "lucide-react";

import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { listUsers } from "@/lib/admin/users";
import { ROLES, ROLE_LABELS, type UserRole } from "@/lib/constants/roles";
import { formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/shared/status-chip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterChip } from "@/components/admin/table-filters";
import { SearchBox } from "@/components/admin/search-box";

export const metadata: Metadata = { title: "Users · TeamApp" };

const BASE = "/app/admin/users";

type SearchParams = { q?: string; role?: string };

function isRole(value: string | undefined): value is UserRole {
  return !!value && (ROLES as readonly string[]).includes(value);
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;

  const users = await listUsers({
    search: sp.q,
    role: isRole(sp.role) ? sp.role : undefined,
  });
  const current = { q: sp.q, role: sp.role };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Search across every company on the platform."
      />

      <div className="flex flex-col gap-3">
        <SearchBox
          name="q"
          placeholder="Search by name or email…"
          defaultValue={sp.q}
          basePath={BASE}
          hidden={{ role: sp.role }}
        />
        <div className="flex flex-wrap gap-2">
          <span className="text-muted-foreground self-center text-xs font-medium">
            Role:
          </span>
          <FilterChip
            label="All"
            paramKey="role"
            basePath={BASE}
            current={current}
          />
          {ROLES.map((r) => (
            <FilterChip
              key={r}
              label={ROLE_LABELS[r]}
              paramKey="role"
              value={r}
              basePath={BASE}
              current={current}
            />
          ))}
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No users found"
          description="Try a different search or role filter."
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`${BASE}/${u.id}`}
                      className="flex items-center gap-2"
                    >
                      <UserAvatar
                        name={u.full_name}
                        src={u.avatar_url}
                        seed={u.id}
                        size="sm"
                      />
                      <span>
                        <span className="block font-medium hover:underline">
                          {u.full_name ?? "—"}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {u.email}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.companyName ?? "—"}
                  </TableCell>
                  <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                  <TableCell>
                    <StatusChip domain="user" status={u.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.last_active_at
                      ? formatDate(u.last_active_at, "relative")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
