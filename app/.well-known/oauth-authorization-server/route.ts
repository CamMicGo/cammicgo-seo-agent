import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
// Authorization server discovery belongs to the actual OAuth issuer.
// Do not impersonate an authorization server or invent authorization/token endpoints.
export function GET(){
 if(process.env.ENABLE_MCP_OAUTH!=='true'||!process.env.MCP_OAUTH_ISSUER)return NextResponse.json({error:'MCP authorization server not configured',status:'not_ready'},{status:503,headers:{'Cache-Control':'no-store'}});
 try{
  const issuer=new URL(process.env.MCP_OAUTH_ISSUER);
  if(issuer.protocol!=='https:'||issuer.username||issuer.password||issuer.search||issuer.hash)throw Error('Invalid issuer');
  const metadata=new URL('/.well-known/oauth-authorization-server'+issuer.pathname.replace(/\/$/,''),issuer.origin);
  return NextResponse.redirect(metadata,307);
 }catch{return NextResponse.json({error:'Invalid issuer'},{status:503})}
}
