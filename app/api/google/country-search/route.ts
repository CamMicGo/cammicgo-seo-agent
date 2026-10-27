import {NextRequest,NextResponse} from 'next/server';
import {getSession,authorizedAccessToken,googleFetch} from '@/lib/google-session';
export const runtime='nodejs';
const alpha3:Record<string,string>={US:'USA',FR:'FRA',GB:'GBR',DE:'DEU',JP:'JPN',KR:'KOR',CN:'CHN',CA:'CAN',AU:'AUS',IN:'IND',BR:'BRA',ES:'ESP',IT:'ITA',RU:'RUS',MX:'MEX',ID:'IDN',NL:'NLD',BE:'BEL',PL:'POL',UA:'UKR',TR:'TUR',AE:'ARE',EG:'EGY',ZA:'ZAF',NZ:'NZL',SG:'SGP',TH:'THA',PT:'PRT',CH:'CHE',AR:'ARG',VN:'VNM',SA:'SAU',HK:'HKG',TW:'TWN',IE:'IRL',AT:'AUT',SE:'SWE',NO:'NOR',DK:'DNK',FI:'FIN',GR:'GRC',CZ:'CZE',RO:'ROU',HU:'HUN',IL:'ISR',MY:'MYS',PH:'PHL',PK:'PAK',BD:'BGD',CO:'COL',CL:'CHL',PE:'PER',NG:'NGA',KE:'KEN',MA:'MAR',TN:'TUN',DZ:'DZA',SK:'SVK',SI:'SVN',HR:'HRV',RS:'SRB'};
export async function GET(request:NextRequest){
 const session=await getSession();if(!session)return NextResponse.json({error:'Connect your Google account'},{status:401});
 const site=request.nextUrl.searchParams.get('site')||'',country=request.nextUrl.searchParams.get('country')||'',period=request.nextUrl.searchParams.get('period')||'28d';
 if(!site||site.length>500||!alpha3[country]||!['24h','28d','all'].includes(period))return NextResponse.json({error:'Select an authorized site and supported country'},{status:400});
 // Search Console does not provide GA4 real-time data. Exclude the current and preceding days for settled metrics.
 const end=new Date(Date.now()-3*86400000).toISOString().slice(0,10);
 const start=period==='all'?'2020-01-01':new Date(Date.now()-(period==='24h'?4:30)*86400000).toISOString().slice(0,10);
 try{
 const {token}=await authorizedAccessToken(session);
 const sites=await googleFetch('https://www.googleapis.com/webmasters/v3/sites',token);
 if(!sites.ok)return NextResponse.json({error:'Could not verify Search Console site access'},{status:403});
 const list=await sites.json() as {siteEntry?:Array<{siteUrl:string}>};
 if(!list.siteEntry?.some(s=>s.siteUrl===site))return NextResponse.json({error:'Access to this site was not granted'},{status:403});
 const endpoint='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(site)+'/searchAnalytics/query';
 const body={startDate:start,endDate:end,dimensions:['query'],dimensionFilterGroups:[{filters:[{dimension:'country',operator:'equals',expression:alpha3[country]}]}],rowLimit:40};
 const response=await googleFetch(endpoint,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 if(!response.ok)return NextResponse.json({error:'Search Console request failed',status:response.status},{status:502});
 const data=await response.json() as {rows?:Array<{keys:string[];clicks:number;impressions:number;ctr:number;position:number}>};
 const rows=data.rows||[];
 return NextResponse.json({site,country,startDate:start,endDate:end,rows,clicks:rows.reduce((a,r)=>a+r.clicks,0),impressions:rows.reduce((a,r)=>a+r.impressions,0),note:'Totals below are sums over returned top queries only; not whole-country totals. Search Console is not real time.'},{headers:{'Cache-Control':'private,no-store'}});
 }catch{return NextResponse.json({error:'Search Console country data unavailable'},{status:502})}
}
