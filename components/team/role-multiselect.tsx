"use client";

import { ROLES, ROLE_LABELS, type UserRole } from "@/lib/constants/roles";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Roles content can be targeted to (super_admin is platform staff, excluded).
const VISIBILITY_ROLES: UserRole[] = ROLES.filter((r) => r !== "super_admin");

/**
 * Multi-select for `visible_to_roles` (PA-1). An empty selection means "visible
 * to everyone" — surfaced explicitly so the default isn't a silent gotcha.
 */
export function RoleMultiSelect({
  value,
  onChange,
  label = "Visible to",
}: {
  value: UserRole[];
  onChange: (roles: UserRole[]) => void;
  label?: string;
}) {
  function toggle(role: UserRole, checked: boolean) {
    onChange(checked ? [...value, role] : value.filter((r) => r !== role));
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex flex-wrap gap-3 rounded-md border p-3">
        {VISIBILITY_ROLES.map((r) => (
          <label
            key={r}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              checked={value.includes(r)}
              onCheckedChange={(c) => toggle(r, c === true)}
            />
            {ROLE_LABELS[r]}
          </label>
        ))}
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {value.length === 0
          ? "No roles selected — visible to everyone."
          : `Visible to: ${value.map((r) => ROLE_LABELS[r]).join(", ")}`}
      </p>
    </div>
  );
}
