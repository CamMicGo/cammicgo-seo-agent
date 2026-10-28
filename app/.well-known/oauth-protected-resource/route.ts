import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){
 const origin=process.env.APP_BASE_URL||'https://seo.cammicgo.com';
 const issuer=process.env.MCP_OAUTH_ISSUER||'https://vfngxjsryklqldarkxhy.supabase.co/auth/v1';
 // Do not advertise a non-operational authorization server.

 try{
  const resource=new URL('/api/mcp',origin).href;
  const auth=new URL(issuer);
  if(auth.protocol!=='https:'||auth.username||auth.password||auth.search||auth.hash)throw Error('Invalid issuer');
  return NextResponse.json({resource,authorization_servers:[auth.origin+auth.pathname.replace(/\/$/,'')],scopes_supported:['openid','email','profile']},{headers:{'Cache-Control':'public, max-age=300','Access-Control-Allow-Origin':'*'}});
 }catch{return NextResponse.json({error:'Invalid MCP OAuth configuration'},{status:503})}
}
