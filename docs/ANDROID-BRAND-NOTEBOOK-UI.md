# Verified brand assets and Notebook Android navigation

## Brand identity
- Show the actual, unmodified OpenAI/ChatGPT logo for ChatGPT requests, Claude's official mark for Claude, Google's Gemini mark for Gemini, and the current Google Gemini Notebook logo for NotebookLM. Do not substitute generic bot icons, AI-generated marks or the CamMicGo logo.
- Google renamed NotebookLM to **Gemini Notebook** in July 2026. Display **Gemini Notebook (NotebookLM)** in navigation during the transition, and use the current official artwork, not an obsolete NotebookLM icon. Source: https://workspaceupdates.googleblog.com/2026/07/notebooklm-now-gemini-notebook.html
- Prefer first-party official SVG/PNG files or existing trusted brand assets. Keep source URL, retrieval date and brand terms documented. Do not modify official colors or geometry. Use original CamMicGo logo already committed for the APK launcher; never replace with a generated approximation.
- Each assistant identity is supplied by a verified assistant connection (not an untrusted request title); map it to an approved brand asset. Unknown connections get a neutral placeholder, never an invented identity.

## Notebook Android UX
- Current NotebookActivity uses a local WebView and hardcoded French prompts; it is not yet a full native Studio interface.
- Navigation labels: Back to CamMicGo, Refresh page, My notebooks, New notebook, Add source, Open in Chrome. Separate connection status, source actions and Studio operations.
- Visual hierarchy: CamMicGo blue/navy and white, consistent rounded controls, 48dp minimum touch target, accessible text and loading/error state.
- All labels, notices, Google sign-in errors, dialog titles, source operations and status messages must use I18n.t with translations in all 11 supported languages; the initial button pass currently only supports French/English and must be generalized before APK release.
- Brand images should be stored as app resources (vector drawable or density-specific PNG), not fetched dynamically for each row. Set contentDescription to the assistant name; avoid duplicate announcement if adjacent text already identifies it.
- Keep the embedded Google page distinct from native CamMicGo controls; do not imply that unimplemented Studio buttons are operational.
- Validate actual Android build, narrow Samsung screen, French/English/RTL layouts and WebView authentication before merging.

## Status
- Navigation label and color changes have been committed to the PR branch.
- **Official logo resources and multi-assistant feed rendering are NOT yet implemented.** No APK release or device validation yet.
