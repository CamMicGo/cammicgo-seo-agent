import {NextRequest,NextResponse} from 'next/server';
import {getSession,authorizedAccessToken,googleFetch,SESSION_COOKIE,cookieOptions,encrypt} from '@/lib/google-session';
import {sealMcpAccess} from '@/lib/mcp-access';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(process.env.ENABLE_MCP_BETA!=='true')return NextResponse.json({error:'MCP private beta is not enabled'},{status:503});
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Invalid origin'},{status:403});
 const session=await getSession();if(!session)return NextResponse.json({error:'Connect a Google account first'},{status:401});
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=='object')return NextResponse.json({error:'Invalid request body'},{status:400});
 const site=typeof body.site==='string'?body.site:'';
 const property=typeof body.property==='string'?body.property:'';
 if(!site&&!property)return NextResponse.json({error:'Select at least one Search Console site or GA4 property'},{status:400});
 if(site.length>500||property.length>90||(property&&!/^properties\/\d+$/.test(property)))return NextResponse.json({error:'Invalid property selection'},{status:400});
 try{
 const {token,updated}=await authorizedAccessToken(session);
 if(site){const response=await googleFetch('https://www.googleapis.com/webmasters/v3/sites',token);if(!response.ok)return NextResponse.json({error:'Unable to verify Search Console access'},{status:403});const list=await response.json();if(!(list.siteEntry||[]).some((p:{siteUrl:string})=>p.siteUrl===site))return NextResponse.json({error:'Selected Search Console site is not authorized'},{status:403})}
 if(property){const response=await googleFetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=100',token);if(!response.ok)return NextResponse.json({error:'Unable to verify GA4 access'},{status:403});const list=await response.json();if(!(list.accountSummaries||[]).some((a:{propertySummaries?:Array<{property:string}>})=>(a.propertySummaries||[]).some(p=>p.property===property)))return NextResponse.json({error:'Selected GA4 property is not authorized'},{status:403})}
 const response=NextResponse.json({...sealMcpAccess({google:updated||session,site:site||undefined,property:property||undefined}),mcpUrl:'https://seo.cammicgo.com/api/mcp',method:'Bearer header',warning:'Temporary 15-minute beta credential; no persistent per-user rate limiting yet. Do not share this token.'},{headers:{'Cache-Control':'no-store','Pragma':'no-cache'}});
 if(updated)response.cookies.set(SESSION_COOKIE,encrypt(updated),cookieOptions);
 return response;
 }catch{return NextResponse.json({error:'Could not create delegated access; try reconnecting'},{status:502})}
}
