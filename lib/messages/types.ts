/**
 * Phase 11 Messages — serializable view models passed from server components to
 * the client. Kept free of server-only imports so client components can import
 * the types.
 */
import type { UserRole } from "@/lib/constants/roles";

export type ThreadType = "direct" | "group" | "channel";

export type ChannelVisibility = "public" | "private";

/** A company member as shown in pickers, mention popovers, and participant lists. */
export type MemberLite = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
};

/** One attachment stored inline on a message (messages.attachments jsonb). */
export type MessageAttachment = {
  path: string;
  name: string;
  size: number | null;
  contentType: string | null;
};

/** An attachment with a freshly-signed download URL (render-time only). */
export type SignedAttachment = MessageAttachment & { url: string };

/** Aggregated reactions for one message. */
export type ReactionGroup = {
  emoji: string;
  count: number;
  /** Display names of reactors, for the tooltip. */
  reactors: string[];
  /** Whether the current viewer is one of the reactors. */
  mine: boolean;
};

/** A single message rendered in the conversation view. */
export type MessageView = {
  id: string;
  threadId: string;
  senderId: string | null;
  senderName: string | null;
  senderAvatarUrl: string | null;
  senderRole: UserRole | null;
  /** Raw body with `<@id>` markers (null when deleted). */
  body: string | null;
  attachments: SignedAttachment[];
  replyToMessageId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  contextType: string;
  contextPayload: Record<string, unknown> | null;
  reactions: ReactionGroup[];
  /** System notice (join/leave/add/remove) — rendered as muted centered text. */
  isSystem: boolean;
};

/** A participant of a thread. */
export type ParticipantView = MemberLite & {
  lastReadAt: string | null;
  isCreator: boolean;
};

/** Left-rail summary row. */
export type ThreadSummary = {
  id: string;
  type: ThreadType;
  /** Resolved display name (other person for DMs, custom/auto name for groups). */
  name: string;
  participants: MemberLite[];
  lastMessage: {
    body: string | null;
    senderName: string | null;
    createdAt: string;
    deleted: boolean;
  } | null;
  unreadCount: number;
  updatedAt: string;
};

/** Full detail for the center pane. */
export type ThreadDetail = {
  id: string;
  type: ThreadType;
  name: string;
  customName: string | null;
  createdBy: string | null;
  /** Channel-only: 'public' | 'private' (null for DMs/groups). */
  visibility: ChannelVisibility | null;
  /** Channel-only topic/description (null for DMs/groups or undescribed). */
  description: string | null;
  /** True for the protected #general channel (cannot rename/archive/privatize). */
  isGeneral: boolean;
  participants: ParticipantView[];
  messages: MessageView[];
  files: Array<SignedAttachment & { messageId: string; uploadedAt: string }>;
};

/** Left-rail / browser summary for a channel. */
export type ChannelSummary = {
  id: string;
  /** Bare channel name (no leading #); the UI prefixes it. */
  name: string;
  description: string | null;
  visibility: ChannelVisibility;
  isGeneral: boolean;
  memberCount: number;
  /** Whether the current viewer is a member. */
  isMember: boolean;
  unreadCount: number;
  /** Last message time, falling back to the channel's updated_at. */
  lastActivityAt: string;
};

/** Single source of truth for unread badges (F-122). */
export type UnreadSummary = {
  total: number;
  perThread: Record<string, number>;
};
