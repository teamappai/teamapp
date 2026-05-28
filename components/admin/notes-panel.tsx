"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/utils/format";
import { createNote, deleteNote } from "@/app/app/admin/actions";
import type { CompanyNote } from "@/lib/admin/companies";
import { StickyNote } from "lucide-react";

export function NotesPanel({
  companyId,
  notes,
}: {
  companyId: string;
  notes: CompanyNote[];
}) {
  const router = useRouter();
  const [body, setBody] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function add() {
    const trimmed = body.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createNote(companyId, trimmed);
      if (res.ok) {
        setBody("");
        toast.success("Note added");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(noteId: string) {
    startTransition(async () => {
      const res = await deleteNote(noteId, companyId);
      if (res.ok) {
        toast.success("Note deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Internal operator notes — visible to super admins only.
      </p>
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note about this customer…"
          rows={3}
        />
        <div className="flex justify-end">
          <Button onClick={add} disabled={pending || !body.trim()} size="sm">
            Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet"
          description="Capture context about this customer for the rest of the platform team."
        />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(note.id)}
                  disabled={pending}
                  aria-label="Delete note"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {note.authorName ?? "Unknown"} ·{" "}
                {formatDate(note.created_at, "relative")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
