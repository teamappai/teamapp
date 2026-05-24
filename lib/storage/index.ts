/**
 * Storage helpers for TeamApp's five buckets. These are isomorphic: pass a
 * Supabase client (browser, server, or service-role) and the helper builds the
 * conventional object path and performs the signed-upload / signed-URL flow.
 *
 * Path conventions (enforced by RLS in migration 0015):
 *   company-logos        <company_id>/<file>
 *   avatars              <user_id>/<file>
 *   deal-files           <company_id>/<deal_id>/<uuid-file>      (private)
 *   request-files        <company_id>/<request_id>/<uuid-file>   (private)
 *   message-attachments  <company_id>/<thread_id>/<uuid-file>    (private)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export type DbClient = SupabaseClient<Database>;

export const BUCKETS = {
  companyLogos: "company-logos",
  avatars: "avatars",
  dealFiles: "deal-files",
  requestFiles: "request-files",
  messageAttachments: "message-attachments",
} as const;

const DEFAULT_SIGNED_URL_TTL = 60 * 60; // 1 hour

/** Prefix a filename with a uuid so uploads never collide / overwrite. */
function uniqueName(filename: string): string {
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  return `${crypto.randomUUID()}-${safe}`;
}

export type UploadResult = { path: string };
export type UploadInput = Blob | ArrayBuffer | ArrayBufferView | File;

/** Signed-upload-URL flow: mint a one-time upload URL, then PUT the bytes. */
async function uploadViaSignedUrl(
  client: DbClient,
  bucket: string,
  path: string,
  file: UploadInput,
): Promise<UploadResult> {
  const created = await client.storage.from(bucket).createSignedUploadUrl(path);
  if (created.error) throw created.error;
  const { token } = created.data;
  const uploaded = await client.storage
    .from(bucket)
    .uploadToSignedUrl(path, token, file);
  if (uploaded.error) throw uploaded.error;
  return { path };
}

/** Time-limited download URL for a private object (default 1 hour). */
async function signedUrl(
  client: DbClient,
  bucket: string,
  path: string,
  expiresIn: number = DEFAULT_SIGNED_URL_TTL,
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Permanent public URL for an object in a public bucket. */
function publicUrl(client: DbClient, bucket: string, path: string): string {
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ── deal files (private) ──────────────────────────────────────────────────────
export function dealFilePath(
  companyId: string,
  dealId: string,
  filename: string,
): string {
  return `${companyId}/${dealId}/${uniqueName(filename)}`;
}

export function uploadDealFile(
  client: DbClient,
  args: {
    companyId: string;
    dealId: string;
    filename: string;
    file: UploadInput;
  },
): Promise<UploadResult> {
  return uploadViaSignedUrl(
    client,
    BUCKETS.dealFiles,
    dealFilePath(args.companyId, args.dealId, args.filename),
    args.file,
  );
}

export function getDealFileUrl(
  client: DbClient,
  path: string,
  expiresIn?: number,
): Promise<string> {
  return signedUrl(client, BUCKETS.dealFiles, path, expiresIn);
}

// ── request files (private) ───────────────────────────────────────────────────
export function requestFilePath(
  companyId: string,
  requestId: string,
  filename: string,
): string {
  return `${companyId}/${requestId}/${uniqueName(filename)}`;
}

export function uploadRequestFile(
  client: DbClient,
  args: {
    companyId: string;
    requestId: string;
    filename: string;
    file: UploadInput;
  },
): Promise<UploadResult> {
  return uploadViaSignedUrl(
    client,
    BUCKETS.requestFiles,
    requestFilePath(args.companyId, args.requestId, args.filename),
    args.file,
  );
}

export function getRequestFileUrl(
  client: DbClient,
  path: string,
  expiresIn?: number,
): Promise<string> {
  return signedUrl(client, BUCKETS.requestFiles, path, expiresIn);
}

// ── message attachments (private) ─────────────────────────────────────────────
export function messageAttachmentPath(
  companyId: string,
  threadId: string,
  filename: string,
): string {
  return `${companyId}/${threadId}/${uniqueName(filename)}`;
}

export function uploadMessageAttachment(
  client: DbClient,
  args: {
    companyId: string;
    threadId: string;
    filename: string;
    file: UploadInput;
  },
): Promise<UploadResult> {
  return uploadViaSignedUrl(
    client,
    BUCKETS.messageAttachments,
    messageAttachmentPath(args.companyId, args.threadId, args.filename),
    args.file,
  );
}

export function getMessageAttachmentUrl(
  client: DbClient,
  path: string,
  expiresIn?: number,
): Promise<string> {
  return signedUrl(client, BUCKETS.messageAttachments, path, expiresIn);
}

// ── avatars (public) ──────────────────────────────────────────────────────────
export function avatarPath(userId: string, filename: string): string {
  return `${userId}/${uniqueName(filename)}`;
}

export function uploadAvatar(
  client: DbClient,
  args: { userId: string; filename: string; file: UploadInput },
): Promise<UploadResult> {
  return uploadViaSignedUrl(
    client,
    BUCKETS.avatars,
    avatarPath(args.userId, args.filename),
    args.file,
  );
}

export function getAvatarUrl(client: DbClient, path: string): string {
  return publicUrl(client, BUCKETS.avatars, path);
}

// ── company logos (public) ────────────────────────────────────────────────────
export function companyLogoPath(companyId: string, filename: string): string {
  return `${companyId}/${uniqueName(filename)}`;
}

export function uploadCompanyLogo(
  client: DbClient,
  args: { companyId: string; filename: string; file: UploadInput },
): Promise<UploadResult> {
  return uploadViaSignedUrl(
    client,
    BUCKETS.companyLogos,
    companyLogoPath(args.companyId, args.filename),
    args.file,
  );
}

export function getCompanyLogoUrl(client: DbClient, path: string): string {
  return publicUrl(client, BUCKETS.companyLogos, path);
}
