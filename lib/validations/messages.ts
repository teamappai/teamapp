import { z } from "zod";
import { REACTION_EMOJIS } from "@/lib/messages/constants";

/**
 * Validation for Phase 11 Messages. Shared between the composer/dialogs and the
 * server actions so the two never drift.
 */

const attachmentSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative().nullable(),
  contentType: z.string().max(255).nullable(),
});

export type AttachmentInput = z.infer<typeof attachmentSchema>;

/** A message must carry text or at least one attachment. */
export const sendMessageSchema = z
  .object({
    threadId: z.string().uuid(),
    /** Client-generated id for optimistic reconciliation. */
    clientId: z.string().min(1).max(64),
    body: z.string().max(8000).default(""),
    attachments: z.array(attachmentSchema).max(10).default([]),
    replyToMessageId: z.string().uuid().nullable().default(null),
  })
  .refine((v) => v.body.trim().length > 0 || v.attachments.length > 0, {
    message: "Write a message or attach a file.",
    path: ["body"],
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** Create a DM (1 recipient) or group (2+) and optionally send a first message. */
export const createThreadSchema = z.object({
  participantIds: z
    .array(z.string().uuid())
    .min(1, "Pick at least one person.")
    .max(20, "That's too many people for one thread."),
  name: z.string().trim().max(120).optional().default(""),
  body: z.string().max(8000).optional().default(""),
});

export type CreateThreadInput = z.infer<typeof createThreadSchema>;

export const editMessageSchema = z.object({
  messageId: z.string().uuid(),
  body: z.string().trim().min(1, "Message can't be empty.").max(8000),
});

export const toggleReactionSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.enum(REACTION_EMOJIS),
});

export const renameThreadSchema = z.object({
  threadId: z.string().uuid(),
  name: z.string().trim().min(1, "Name can't be empty.").max(120),
});

export const addParticipantsSchema = z.object({
  threadId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1).max(20),
});

export const removeParticipantSchema = z.object({
  threadId: z.string().uuid(),
  userId: z.string().uuid(),
});

// ── channels (Phase 11.5) ─────────────────────────────────────────────────────

/** Server-side channel-name rule: 1..80 chars of [a-z0-9-], no leading/trailing -. */
const channelNameSchema = z
  .string()
  .trim()
  .min(1, "Give your channel a name.")
  .max(80, "Channel names are 80 characters max.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens only.",
  );

const channelDescriptionSchema = z
  .string()
  .trim()
  .max(500, "Descriptions are 500 characters max.")
  .optional()
  .default("");

export const createChannelSchema = z.object({
  name: channelNameSchema,
  description: channelDescriptionSchema,
  visibility: z.enum(["public", "private"]),
  memberIds: z.array(z.string().uuid()).max(100).optional().default([]),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;

export const updateChannelSchema = z.object({
  channelId: z.string().uuid(),
  name: channelNameSchema.optional(),
  description: channelDescriptionSchema,
  visibility: z.enum(["public", "private"]).optional(),
});

export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;

export const channelIdSchema = z.object({ channelId: z.string().uuid() });

export const channelMembersSchema = z.object({
  channelId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).min(1).max(100),
});

export const channelMemberSchema = z.object({
  channelId: z.string().uuid(),
  userId: z.string().uuid(),
});

/** Typed-confirmation guard for the destructive archive (Decision 10). */
export const archiveChannelSchema = z.object({
  channelId: z.string().uuid(),
  confirm: z.literal("ARCHIVE"),
});
