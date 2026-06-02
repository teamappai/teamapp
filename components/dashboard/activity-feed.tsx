"use client";

import * as React from "react";
import Link from "next/link";

import type { FeedItem, FeedCategory } from "@/lib/dashboards/shared";
import { formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { loadMoreActivityFeed } from "@/app/app/dashboard/actions";
import { cn } from "@/lib/utils/index";

type Filter = "all" | FeedCategory;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "deals", label: "Deals" },
  { key: "requests", label: "Requests" },
  { key: "activity", label: "Activity" },
  { key: "training", label: "Training" },
];

/**
 * Recent activity feed with category filters + explicit "Load more" (50 at a
 * time — no infinite scroll, Decision 13). Filtering is client-side over the
 * loaded window; "Load more" pulls the next page via a server action.
 *
 * `availableFilters` lets a role hide filters that can never have events (e.g.
 * marketing only ever has Requests/Activity/Training — never Deals per F-133).
 */
export function ActivityFeed({
  initial,
  availableFilters,
  rangeFrom,
  rangeTo,
}: {
  initial: FeedItem[];
  availableFilters?: Filter[];
  /** Optional inclusive YYYY-MM-DD bounds — when set, the feed is date-scoped. */
  rangeFrom?: string;
  rangeTo?: string;
}) {
  const [items, setItems] = React.useState<FeedItem[]>(initial);
  const [filter, setFilter] = React.useState<Filter>("all");
  const [loading, setLoading] = React.useState(false);
  const [exhausted, setExhausted] = React.useState(initial.length < 50);

  const filters = availableFilters
    ? FILTERS.filter((f) => availableFilters.includes(f.key))
    : FILTERS;

  const inRange = (it: FeedItem) => {
    if (!rangeFrom && !rangeTo) return true;
    const day = it.occurredAt.slice(0, 10);
    if (rangeFrom && day < rangeFrom) return false;
    if (rangeTo && day > rangeTo) return false;
    return true;
  };

  const dateScoped = items.filter(inRange);
  const visible =
    filter === "all"
      ? dateScoped
      : dateScoped.filter((i) => i.category === filter);

  async function loadMore() {
    setLoading(true);
    try {
      const next = await loadMoreActivityFeed(items.length);
      setItems((prev) => [...prev, ...next]);
      if (next.length < 50) setExhausted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {filters.map((f) => (
          <Button
            key={f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No activity to show yet.
        </p>
      ) : (
        <ul className="divide-border divide-y rounded-md border">
          {visible.map((item) => {
            const inner = (
              <div className="flex items-start gap-3 px-3 py-2.5">
                <UserAvatar
                  name={item.actorName}
                  src={item.actorAvatar}
                  seed={item.actorId}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{item.text}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(item.occurredAt, "relative")}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={cn("hover:bg-accent block")}
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            );
          })}
        </ul>
      )}

      {filter === "all" && !exhausted ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
