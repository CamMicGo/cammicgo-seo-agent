import {NextResponse} from 'next/server';
export const runtime='nodejs';
export async function GET(){
 const privateBeta=process.env.ENABLE_MCP_BETA==='true';
 // Never return environment-variable values or OAuth credentials.
 return NextResponse.json({
  name:'CamMicGo SEO MCP',transport:'Streamable HTTP',
  endpoint:'https://seo.cammicgo.com/api/mcp',
  publicDiscovery:true,
  publicTools:['service_info'],
  privateGoogleToolsEnabled:privateBeta,
  authentication:privateBeta?'Temporary 15-minute scoped bearer (controlled beta only)':'MCP OAuth authorization server not yet configured',
  oauthMcpReady:false,
  sharedDailyQuotaEnforced:false,
  localMcpAvailable:true,
  localSetup:'https://github.com/CamMicGo/cammicgo-seo-mcp#local-mcp-server-read-only-preview',
  warning:'Do not enable the private beta for public clients before OAuth, revocation and durable quotas are implemented.'
 },{headers:{'Cache-Control':'public,max-age=60'}});
}
