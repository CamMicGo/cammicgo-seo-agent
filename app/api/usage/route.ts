import {NextResponse} from 'next/server';
import {getSession} from '@/lib/google-session';
export const runtime='nodejs';
export async function GET(){
 const session=await getSession();
 if(!session)return NextResponse.json({error:'Connect Google first'},{status:401});
 // Accurate accounting requires durable counters shared by web requests and authenticated MCP tools.
 // Never return synthetic usage numbers or indicate enforcement without a shared store.
 return NextResponse.json({enabled:false,configuredDailyLimit:30,remaining:null,used:null,window:'UTC calendar day (proposed)',scope:'Future combined MCP + dashboard API requests',message:'Daily limit is proposed, but not enforced yet. Private MCP access remains disabled until durable counters and OAuth client authorization are ready.',providerQuota:'Google GA4 real property quotas are displayed within each GA4 report.'},{headers:{'Cache-Control':'private,no-store'}});
}
