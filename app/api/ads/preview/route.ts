import {NextRequest,NextResponse} from 'next/server';
import {getSession} from '@/lib/google-session';
import {makeCampaignDraft} from '@/lib/ads-campaign';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Invalid origin'},{status:403});
 if(!await getSession())return NextResponse.json({error:'Connect a Google account before creating a preview'},{status:401});
 const raw=await req.text();if(raw.length>12000)return NextResponse.json({error:'Request too large'},{status:413});
 try {const draft=makeCampaignDraft(JSON.parse(raw));return NextResponse.json({draft,liveGoogleAdsAccess:false,submittedToGoogle:false,warning:'Preview only. No Google Ads campaign is created, activated, or charged. Google Ads API access and explicit final human confirmation are required for actual creation.'},{headers:{'Cache-Control':'no-store'}})}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid request'},{status:400})}
}
