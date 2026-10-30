import Link from 'next/link';
import {getSession} from '@/lib/google-session';
export const dynamic='force-dynamic';
export default async function RemoteMcp(){
 const session=await getSession();
 const tools=[
  ['service_info','Public connection discovery'],
  ['search_performance','GSC organic performance — private beta'],
  ['seo_keyword_opportunities','GSC opportunities — private beta'],
  ['ga4_top_pages','GA4 top pages — private beta'],
  ['ga4_countries','GA4 countries — private beta'],
  ['prepare_ads_campaign','Preview only — creates no ad campaign'],
 ];
 const privateActive=process.env.ENABLE_SUPABASE_MCP_AUTH==='true';
 return <main className="legal-page">
  <Link href="/dashboard">← Dashboard</Link><h1>Remote MCP — Connection status</h1>
  <p>CamMicGo SEO MCP's public remote MCP endpoint is <code>https://seo.cammicgo.com/api/mcp</code>.</p>
  <section className="connect-card"><h2>Your Google connection</h2>
  <p>{session?'A Google browser session is present.':'No Google browser session is present.'}</p>
  <p>Important: a browser sign-in is not an OAuth authorization for ChatGPT or Claude. We never send the Google refresh token to an AI client.</p>
  <p><Link href="/account">Connect Google / use your own Google Cloud OAuth client</Link></p>
  </section>
  <section className="connect-card"><h2>Remote AI client authentication</h2>
  <p><strong>{privateActive?'Supabase-backed MCP identity verification is configured for controlled tests.':'Public remote Google tools are not enabled yet.'}</strong></p>
  <p>{privateActive?'Account linking to Google and shared quotas are still pending. Only account identity/status tools are available in this mode.':'The current public server only exposes service_info. Full OAuth 2.1 client consent, durable quota enforcement and server-side Google linking are not yet deployed.'}</p>
  <p>We will not activate private Google tools for anonymous clients or expose cross-user data.</p></section>
  <h2>Tool rollout</h2><div className="scroll-table"><table><thead><tr><th>Tool</th><th>Current capability</th></tr></thead><tbody>{tools.map(([name,status])=><tr key={name}><td><code>{name}</code></td><td>{status}</td></tr>)}</tbody></table></div>
  <h2>Connect your agent</h2>
  <p>ChatGPT custom MCP setup is currently performed on the web, not directly in the mobile app. Claude remote connector availability depends on your client and plan. Do not paste Google client secrets into AI chats.</p>
  <p><a href="https://github.com/CamMicGo/cammicgo-seo-mcp/blob/main/docs/CONNECTING-AGENTS.md" rel="noopener noreferrer" target="_blank">Current MCP connection guide ↗</a></p>
 </main>
}
