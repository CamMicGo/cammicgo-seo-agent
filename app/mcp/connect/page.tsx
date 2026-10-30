import type { Metadata } from 'next';
import { RelayFlow, RelayLimits, RelaySteps } from '../../relay-explainer';

export const metadata: Metadata = {
  title: 'Connect AI agents | CamMicGo SEO MCP',
  description: 'Connect Claude, ChatGPT or Gemini CLI to the CamMicGo remote MCP server, authorize Google with the shared project or your own Google Cloud quota, and get YouTube transcripts through the Android app.',
};

const LOGO = 'https://avatars.githubusercontent.com/u/322584442?v=4';
const MCP_URL = 'https://seo.cammicgo.com/api/mcp';
const REDIRECT = 'https://seo.cammicgo.com/api/auth/google/callback';

const tools = [
  { icon: '/google-search-console.svg', name: 'Search Console', text: 'Clicks, impressions, CTR and positions by query, page, country, device or date.' },
  { icon: '/api/assets/google-analytics', name: 'Google Analytics 4', text: 'Sessions, active users and page views by country, page or date.' },
  { icon: '/google-logos/youtube.svg', name: 'YouTube', text: 'Search videos, channel and video details, and timestamped transcripts through your phone.' },
  { icon: '/google-logos/calendar.png', name: 'Google Calendar', text: 'Read your calendars and find past or upcoming events.' },
];

export default function McpConnect() {
  return (
    <div className="site">
      <header className="header">
        <a className="brand" href="/"><img src={LOGO} alt="CamMicGo logo" width="46" height="46" /><span>CamMicGo <b>SEO MCP</b></span></a>
        <a href="/" style={{ color: '#285bd9', fontWeight: 700 }}>← Home</a>
      </header>

      <section className="hero" style={{ paddingTop: 56, paddingBottom: 40 }}>
        <span className="eyebrow">REMOTE MCP · STEP BY STEP</span>
        <h1>Connect your <span>AI assistant</span></h1>
        <p className="lead">Add the CamMicGo MCP server to Claude, ChatGPT or Gemini CLI, sign in, and choose whether Google API calls use the shared CamMicGo project or your own Google Cloud quota.</p>
      </section>

      <section className="feature-section" style={{ paddingTop: 0 }}>
        <span className="kicker">1 · ADD THE SERVER</span>
        <h2>Paste one URL in your assistant</h2>
        <div className="connect-grid">
          <article className="connect-card">
            <h3>Server URL (Streamable HTTP)</h3>
            <p><code className="connect-url">{MCP_URL}</code></p>
            <p>In <strong>Claude</strong>, add a custom connector with this URL. In <strong>ChatGPT</strong>, add it as a custom MCP connector where your plan supports it. Then follow the sign-in window: create or use your CamMicGo account and approve access.</p>
          </article>
          <article className="connect-card">
            <h3>Gemini CLI</h3>
            <p>Add this to <code>~/.gemini/settings.json</code>, then restart Gemini CLI:</p>
            <pre className="connect-pre">{'{\n  "mcpServers": {\n    "cammicgo-seo": { "httpUrl": "' + MCP_URL + '" }\n  }\n}'}</pre>
          </article>
        </div>
      </section>

      <section className="feature-section" style={{ paddingTop: 0 }}>
        <span className="kicker">2 · AUTHORIZE GOOGLE</span>
        <h2>Shared quota or your own Google Cloud project</h2>
        <p className="lead">During sign-in, the consent page asks how Google APIs should be called. You can change it later by disconnecting and reconnecting the connector.</p>
        <div className="connect-grid">
          <article className="connect-card">
            <h3>CamMicGo project (default)</h3>
            <p>Nothing to set up. Calls use CamMicGo’s Google Cloud quota, shared by all users, with a cap of <strong>150 requests per day</strong> per account.</p>
          </article>
          <article className="connect-card connect-card-accent">
            <h3>My own Google Cloud project</h3>
            <p>Calls count against <strong>your own quota</strong>, and the CamMicGo cap rises to <strong>2,000 requests per day</strong>. Your client secret is sent over HTTPS, stored encrypted and never shared with the AI assistant.</p>
          </article>
        </div>
        <ol className="relay-steps" style={{ marginTop: 22 }}>
          <li><span className="relay-step-num">1</span><h3>Create a project</h3><p>In Google Cloud Console, create a project and enable Search Console, Analytics Data, Analytics Admin, YouTube Data API v3 and Calendar. <a href="/setup/google-cloud">Illustrated checklist ↗</a></p></li>
          <li><span className="relay-step-num">2</span><h3>Consent screen</h3><p>Configure Google Auth Platform. In Testing mode, add your Google address under Audience › Test users.</p></li>
          <li><span className="relay-step-num">3</span><h3>Web OAuth client</h3><p>Create a client of type <strong>Web application</strong> with this authorized redirect URI: <code className="connect-url">{REDIRECT}</code></p></li>
          <li><span className="relay-step-num">4</span><h3>Paste it at sign-in</h3><p>On the consent page, choose “Use my own Google Cloud project” and paste the client ID and secret. <code>service_info</code> then reports “own Google Cloud project”.</p></li>
        </ol>
      </section>

      <section className="feature-section" style={{ paddingTop: 0 }}>
        <span className="kicker">3 · ASK</span>
        <h2>What your assistant can read</h2>
        <div className="connect-tools">
          {tools.map(t => (
            <article className="connect-card" key={t.name}>
              <div className="google-service-head"><img src={t.icon} alt="" width="36" height="36" /><h3>{t.name}</h3></div>
              <p>{t.text}</p>
            </article>
          ))}
        </div>
        <p className="notice">Read-only access. Google Ads campaign writes and Keyword Planner are not available. Never paste API keys, refresh tokens or OAuth secrets into AI prompts or public issues.</p>
      </section>

      <section className="feature-section" style={{ paddingTop: 0 }}>
        <span className="kicker">YOUTUBE TRANSCRIPTS</span>
        <h2>Transcripts come from your phone</h2>
        <p className="lead">YouTube blocks cloud servers, so the remote MCP cannot fetch captions itself. Pair the free CamMicGo Android app once, keep it in connected mode, and your assistant gets timestamped transcripts.</p>
        <RelayFlow lang="en" />
        <RelaySteps lang="en" />
        <RelayLimits lang="en" />
        <p className="notice"><a href="/download">Download the Android app ↗</a> · No Android phone? The <a href="/setup/local">local MCP server</a> fetches transcripts directly from your computer.</p>
      </section>
    </div>
  );
}
