"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { uploadAvatar, getAvatarUrl } from "@/lib/storage/index";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { updateAvatar } from "./actions";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function AvatarUploader({
  userId,
  name,
  initialUrl,
}: {
  userId: string;
  name: string | null;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [pending, setPending] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be under 5 MB.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { path } = await uploadAvatar(supabase, {
        userId,
        filename: file.name,
        file,
      });
      const publicUrl = getAvatarUrl(supabase, path);
      const result = await updateAvatar(publicUrl);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setUrl(publicUrl);
      toast.success("Avatar updated");
      router.refresh();
    } catch {
      toast.error("Upload failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={name} src={url} seed={userId} size="lg" />
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          Change avatar
        </Button>
        <p className="text-muted-foreground text-xs">PNG or JPG, up to 5 MB.</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}
