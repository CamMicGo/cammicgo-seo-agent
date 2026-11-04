/**
 * LinkedIn personal messaging: shared Android/desktop relay contract.
 *
 * This module intentionally does not automate LinkedIn, bypass platform controls,
 * store credentials, or expose unimplemented MCP tools. The Android executor and
 * transport wiring must be implemented and verified before enabling commands.
 */
export const LINKEDIN_PERSONAL_OPERATIONS = [
  'connection_status',
  'messages_list',
  'messages_read',
  'message_prepare',
  'message_send',
  'people_search',
] as const;

export type LinkedInPersonalOperation = typeof LINKEDIN_PERSONAL_OPERATIONS[number];
export type LinkedInPersonalDevice = 'android' | 'desktop';
export type LinkedInPersonalJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'requires_user_action';

export type LinkedInPersonalJob = {
  operation: LinkedInPersonalOperation;
  device: LinkedInPersonalDevice;
  requestId: string;
  accountId: string;
  payload: Record<string, unknown>;
};

export type LinkedInConversation = {
  id: string;
  title: string;
  unread: boolean;
  lastMessageAt?: string;
  lastMessagePreview?: string;
};
export type LinkedInMessage = {
  id: string;
  conversationId: string;
  sender: string;
  text: string;
  sentAt?: string;
  isOwnMessage: boolean;
};
export type LinkedInPerson = {
  name: string;
  profileUrl: string;
  headline?: string;
  isConnection?: boolean;
};

/** Never send a private message without a new, explicit confirmation. */
export type LinkedInSendConfirmation = {
  conversationId: string;
  recipientDisplayName: string;
  messageText: string;
  confirmationToken: string;
  expiresAt: number;
};

export function validateLinkedInJob(job: LinkedInPersonalJob): string | null {
  if (!LINKEDIN_PERSONAL_OPERATIONS.includes(job.operation)) return 'unsupported_operation';
  if (job.device !== 'android' && job.device !== 'desktop') return 'unsupported_device';
  if (!job.requestId || !job.accountId) return 'missing_identity';
  if (!job.payload || typeof job.payload !== 'object' || Array.isArray(job.payload)) return 'invalid_payload';
  if (job.operation === 'messages_read' || job.operation === 'message_prepare' || job.operation === 'message_send') {
    if (typeof job.payload.conversationId !== 'string' || !job.payload.conversationId.trim()) return 'conversation_required';
  }
  if (job.operation === 'people_search') {
    const q = job.payload.query;
    if (typeof q !== 'string' || !q.trim() || q.length > 160) return 'invalid_query';
  }
  if (job.operation === 'message_prepare' || job.operation === 'message_send') {
    const t = job.payload.messageText;
    if (typeof t !== 'string' || !t.trim() || t.length > 5000) return 'invalid_message';
  }
  if (job.operation === 'message_send') {
    if (job.payload.confirm !== true) return 'explicit_confirmation_required';
    if (typeof job.payload.confirmationToken !== 'string' || !job.payload.confirmationToken) return 'confirmation_token_required';
  }
  return null;
}

export function canSendLinkedInMessage(
  confirmation: LinkedInSendConfirmation,
  input: { conversationId: string; messageText: string; confirmationToken: string; now: number },
): boolean {
  return input.now < confirmation.expiresAt
    && input.conversationId === confirmation.conversationId
    && input.messageText === confirmation.messageText
    && input.confirmationToken === confirmation.confirmationToken;
}

/** The executor must stop, not retry, when LinkedIn requests account verification. */
export const LINKEDIN_STOP_REASONS = [
  'login_required',
  'verification_required',
  'captcha_required',
  'rate_limited',
  'account_restricted',
  'session_expired',
] as const;
