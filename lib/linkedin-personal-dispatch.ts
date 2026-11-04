import {
  LINKEDIN_STOP_REASONS,
  type LinkedInPersonalJob,
  type LinkedInPersonalOperation,
  validateLinkedInJob,
} from './linkedin-personal-contract';

/** Executor-facing result: no credentials or cookies should ever be included. */
export type LinkedInPersonalResult =
  | { status: 'done'; data: unknown }
  | { status: 'requires_user_action'; reason: typeof LINKEDIN_STOP_REASONS[number] }
  | { status: 'error'; code: string };

export type LinkedInPersonalExecutor = (
  operation: LinkedInPersonalOperation,
  payload: Record<string, unknown>,
) => Promise<LinkedInPersonalResult>;

export type LinkedInPersonalGuard = {
  /** Check that the authenticated device belongs to the requesting account. */
  authorize: (accountId: string, requestId: string) => Promise<boolean>;
  /** Atomically claim requestId, returning false if it was already executed. */
  claim: (accountId: string, requestId: string) => Promise<boolean>;
  /** Consume the confirmation in persistent storage, checking exact content and recipient. */
  consumeSendConfirmation: (
    accountId: string,
    conversationId: string,
    messageText: string,
    confirmationToken: string,
  ) => Promise<boolean>;
};

const isStopReason = (reason: unknown): reason is typeof LINKEDIN_STOP_REASONS[number] =>
  typeof reason === 'string' && (LINKEDIN_STOP_REASONS as readonly string[]).includes(reason);

/**
 * Safe dispatch boundary shared by Android and future desktop executors.
 * Do not call from an MCP endpoint until an authenticated paired-device
 * transport and real LinkedIn UI executor are implemented.
 */
export async function dispatchLinkedInPersonalJob(
  job: LinkedInPersonalJob,
  guard: LinkedInPersonalGuard,
  execute: LinkedInPersonalExecutor,
): Promise<LinkedInPersonalResult> {
  const error = validateLinkedInJob(job);
  if (error) return { status: 'error', code: error };
  if (!(await guard.authorize(job.accountId, job.requestId))) {
    return { status: 'error', code: 'unauthorized_device' };
  }
  if (!(await guard.claim(job.accountId, job.requestId))) {
    return { status: 'error', code: 'duplicate_request' };
  }
  if (job.operation === 'message_send') {
    const approved = await guard.consumeSendConfirmation(
      job.accountId,
      job.payload.conversationId as string,
      job.payload.messageText as string,
      job.payload.confirmationToken as string,
    );
    if (!approved) return { status: 'error', code: 'confirmation_missing_or_used' };
  }
  try {
    const result = await execute(job.operation, job.payload);
    if (result.status === 'requires_user_action' && !isStopReason(result.reason)) {
      return { status: 'error', code: 'invalid_challenge' };
    }
    return result;
  } catch {
    // Never return private messages or browser errors to generic logs.
    return { status: 'error', code: 'device_execution_failed' };
  }
}
