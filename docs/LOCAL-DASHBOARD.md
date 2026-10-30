# CamMicGo local campaign dashboard (prototype)

Run `npm run local:dashboard` on your own computer (Node.js 22+). A private browser URL is printed in the terminal. The server listens only on `127.0.0.1:38741` and uses a random per-process session secret. Stop with Ctrl+C.

The dashboard currently includes an overview, a campaign draft form, recipient/message preview, a **mark as reviewed** action, and a local activity history. Drafts are stored in `~/.cammicgo-seo-agent/campaigns-local.json` (local file permissions where supported). The logo is a temporary CamMicGo-styled icon; the approved branded artwork is not yet embedded.

**Important limitations:** This is a standalone prototype, not yet wired to MCP agent events, Gmail, Sheets, Google OAuth scopes, or actual sending. The activity page records dashboard actions only. Marking reviewed does not authorize sending and sends nothing. There is no public web exposure or CamMicGo cloud dependency. This is not an enterprise-grade encrypted storage solution: protect your computer and avoid putting real sensitive contact lists into the prototype until local encryption and a full security review are implemented.

Planned next step: implement a shared local campaign store and a narrow authenticated event interface, then register MCP tools for creating drafts and reporting progress; the human approval path must remain inaccessible to the LLM.