# ChatGPT Plugins Directory listing — English draft

> **Status:** DRAFT, NOT SUBMITTED. Do not publish until the production MCP endpoint passes Scan Tools, OAuth account linking, Google permission isolation and enforced shared quotas. Do not claim Google Ads Keyword Planner, YouTube or Calendar support until those tools work.

## Form fields (public submission length limits)

**Display name (max 30):** CamMicGo SEO MCP

**Short description (max 30):** Google SEO & Analytics

**Developer name (max 80):** CamMicGo

**Category:** Productivity (select the actual available category from the submission UI)

**Website URL:** https://seo.cammicgo.com

**Support URL:** Supply a working HTTPS support page/contact endpoint before submitting.

**Privacy policy URL:** Supply a working HTTPS privacy policy page before submitting.

**Terms of service URL:** Supply a working HTTPS terms page before submitting.

**MCP URL:** https://seo.cammicgo.com/api/mcp

**Long description (max 4,000):**

CamMicGo SEO MCP helps website owners and SEO professionals explore their own Google Search Console and Google Analytics 4 data from compatible AI assistants.

Connect your Google account, select the sites and analytics properties you are permitted to access, and ask questions about search queries, clicks, impressions, click-through rates, average search position, top pages, and traffic by country. Identify potential SEO opportunities using real Search Console performance data.

Built as an open-source project, CamMicGo supports a browser dashboard and is developing a secure authenticated MCP connector for AI agents.

Current limitations: Hosted AI-agent authorization and shared usage quotas are still being finalized. Google Ads campaign planning is preview-only and cannot launch or spend on campaigns. Google Ads Keyword Planner, YouTube, and Calendar tools are not yet available. Do not use this listing as evidence that these modules are already connected.

**Suggested starter prompts (max 3, each max 128):**

1. Show the top search queries for my connected website over the last 28 days.
2. Which pages receive the most visits in my connected Google Analytics property?
3. Find high-impression keywords with opportunities to improve organic CTR.

**Capability labels (max 20, each max 120):**

- Read authorized Search Console query metrics
- Review GA4 top pages and traffic by country
- Identify potential organic keyword opportunities
- Prepare non-spending Google Ads campaign drafts (private beta only)

## Logo

**New logo asset: PENDING.** The current repository README references a GitHub avatar, which has not been verified to be the user's new approved logo. Do not silently substitute it for the new brand artwork.

The Plugins Directory requires a square icon, at least 48×48 pixels, at most 4,096×4,096 pixels (raster), and a file size no greater than 5 MiB. Supported formats: PNG, JPEG, WebP, SVG. Prefer a crisp 512×512 transparent PNG; prepare an additional square composer icon when packaging a plugin. Upload the user's approved new logo to the listing form.

## Review prerequisites

- Live HTTPS MCP endpoint; discoverable tools with accurate security annotations
- OAuth credentials and tested user isolation, with a review demo
- Verified ownership of the MCP domain
- Working website, support, privacy, and terms URLs
- Scanned tools, review prompts and truthful feature descriptions
- No private Google or user tokens in plugin metadata or repository
