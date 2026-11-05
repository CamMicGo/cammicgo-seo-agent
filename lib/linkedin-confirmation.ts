/**
 * LinkedIn confirmation policy: previews never dispatch. The MCP client must
 * request explicit user approval of the exact recipient and content in a new turn
 * before invoking a tool with confirm=true.
 * No persistence, extra signing key, or confirmation database is needed.
 */
export function linkedInPreview<T extends Record<string, unknown>>(details:T) {
  return {status:'preview',...details,note:'No action sent. Ask the user to explicitly approve these exact details in a new message.'};
}
