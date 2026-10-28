import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
// This app is not itself an OAuth authorization server. The configured, independently
// operational issuer must provide RFC 8414 metadata and token endpoints.
export function GET(){
 if(process.env.ENABLE_MCP_OAUTH!=='true'||!process.env.MCP_OAUTH_ISSUER)return NextResponse.json({error:'No active MCP authorization server',status:'not_ready'},{status:503,headers:{'Cache-Control':'no-store'}});
 const issuer=process.env.MCP_OAUTH_ISSUER;
 return NextResponse.json({error:'Authorization-server metadata is served by the configured issuer, not by the CamMicGo resource server.',issuer},{status:404,headers:{'Cache-Control':'no-store'}});
}
