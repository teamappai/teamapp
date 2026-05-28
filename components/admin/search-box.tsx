import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * A GET search form (no client JS). Submits to `basePath` with the search term
 * under `name`, carrying forward the other current params as hidden fields so a
 * search doesn't drop the active filters/sort.
 */
export function SearchBox({
  name = "q",
  placeholder,
  defaultValue,
  basePath,
  hidden = {},
}: {
  name?: string;
  placeholder?: string;
  defaultValue?: string;
  basePath: string;
  /** Other params to preserve across the search submit. */
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form
      action={basePath}
      method="get"
      className="relative w-full sm:max-w-xs"
    >
      {Object.entries(hidden).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder ?? "Search"}
      />
    </form>
  );
}
