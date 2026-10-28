import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){
 const origin=process.env.APP_BASE_URL||'https://seo.cammicgo.com';
 const issuer=process.env.MCP_OAUTH_ISSUER||'https://vfngxjsryklqldarkxhy.supabase.co/auth/v1';
 // Do not advertise a non-operational authorization server.
 if(process.env.ENABLE_SUPABASE_MCP_AUTH!=='true')return NextResponse.json({error:'MCP OAuth is not configured',status:'not_ready'},{status:503,headers:{'Cache-Control':'no-store'}});
 try{
  const resource=new URL('/api/mcp',origin).href;
  const auth=new URL(issuer);
  if(auth.protocol!=='https:'||auth.username||auth.password||auth.search||auth.hash)throw Error('Invalid issuer');
  return NextResponse.json({resource,authorization_servers:[auth.origin+auth.pathname.replace(/\/$/,'')],scopes_supported:['mcp:read']},{headers:{'Cache-Control':'public, max-age=300','Access-Control-Allow-Origin':'*'}});
 }catch{return NextResponse.json({error:'Invalid MCP OAuth configuration'},{status:503})}
}
