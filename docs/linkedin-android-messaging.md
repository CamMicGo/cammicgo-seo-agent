# LinkedIn personal messaging — Android-first implementation

Status: **foundation only**, not functional or deployed. The existing official OAuth/publishing integration remains unchanged.

## Scope
- Android CamMicGo APK operates without a desktop computer.
- MCP reads conversations and messages, searches people, and prepares a reply.
- A private message is sent only after the user has reviewed the exact recipient and text and explicitly confirmed in a new interaction.
- Desktop-local MCP support can reuse the same contract later.

## Security and implementation gates
1. Device-side authenticated session stays on the Android device; never relay cookies, passwords, or tokens to the model or Vercel.
2. Reuse the existing paired-device authentication and job relay, with user/account ownership checks and short-lived jobs. Prevent replay and cross-account access.
3. Implement a dedicated Android executor and test its lifecycle in foreground/background; do not assume NotebookLM's transport guarantees LinkedIn browser automation.
4. Implement read-only operations first, then draft/confirmation, then send. Re-read the destination before sending; bind the confirmation to exact conversation and message text, expire and consume it once.
5. Stop immediately on CAPTCHA, login challenge, account restriction, or rate limit. No evasion, stealth, bulk messaging, or unsolicited connection invitations.
6. Avoid logging message bodies and profile information. Minimize retention and support user-driven disconnect and deletion.
7. Add tests for payload validation, authorization, expired/used confirmation, incorrect recipient, background suspension, and duplicate delivery.
8. Register MCP commands only after the Android executor is implemented and verified; do not expose placeholders as working tools.
9. Stage on a feature branch, run CI, and deploy only after Vercel's deployment quota is available and user approves deployment.

## Proposed MCP tools
`linkedin_connection_status`, `linkedin_messages_list`, `linkedin_messages_read`, `linkedin_message_prepare`, `linkedin_message_send`, `linkedin_people_search`.

## Acceptance criteria
- No PC required.
- Read a real authorized conversation and search a real connection on Android.
- Preview an exact message before sending; reject send without explicit approval.
- Confirm a single delivery, including retry/deduplication handling.
- On verification challenges, stop and prompt user for manual action.
