import {NextRequest,NextResponse} from 'next/server';
import {getSession,authorizedAccessToken,googleFetch,SESSION_COOKIE,encrypt,cookieOptions} from '@/lib/google-session';
export const runtime='nodejs';
export async function GET(req:NextRequest){
 const session=await getSession();if(!session)return NextResponse.json({error:'Google account not connected'},{status:401});
 const property=req.nextUrl.searchParams.get('property')||'';
 if(!/^properties\/\d{1,20}$/.test(property))return NextResponse.json({error:'Invalid GA4 property'},{status:400});
 const period=req.nextUrl.searchParams.get('period')||'28d';if(!['24h','28d','all'].includes(period))return NextResponse.json({error:'Invalid period'},{status:400});
 const country=req.nextUrl.searchParams.get('country')||'';if(country&&!/^[A-Z]{2}$/.test(country))return NextResponse.json({error:'Invalid country code'},{status:400});
 const dateRange=period==='24h'?{startDate:'yesterday',endDate:'today'}:period==='all'?{startDate:'2020-01-01',endDate:'yesterday'}:{startDate:'28daysAgo',endDate:'yesterday'};
 const countryFilter=country?{filter:{fieldName:'countryId',stringFilter:{value:country,matchType:'EXACT'}}}:undefined;
 try{
  const {token,updated}=await authorizedAccessToken(session);
  const accounts=await googleFetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=100',token);
  if(!accounts.ok)return NextResponse.json({error:'Unable to verify Analytics property access; check Google Analytics Admin API'},{status:403});
  const list=await accounts.json() as {accountSummaries?:Array<{propertySummaries?:Array<{property:string}>}>};
  if(!list.accountSummaries?.some(a=>a.propertySummaries?.some(p=>p.property===property)))return NextResponse.json({error:'Google Analytics property is not accessible to this account'},{status:403});
  const endpoint='https://analyticsdata.googleapis.com/v1beta/'+property+':runReport';
  const body={dateRanges:[dateRange],dimensions:[{name:'date'}],metrics:[{name:'activeUsers'},{name:'sessions'},{name:'screenPageViews'},{name:'engagedSessions'}],limit:period==='all'?2500:32,dimensionFilter:countryFilter,returnPropertyQuota:true,orderBys:[{dimension:{dimensionName:'date'}}]};
  const [dailyResponse,pagesResponse,countriesResponse]=await Promise.all([
   googleFetch(endpoint,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
   googleFetch(endpoint,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:'28daysAgo',endDate:'yesterday'}],dimensions:[{name:'pagePath'}],metrics:[{name:'screenPageViews'},{name:'activeUsers'}],limit:15,dimensionFilter:countryFilter,returnPropertyQuota:true,orderBys:[{metric:{metricName:'screenPageViews'},desc:true}]})}),
   googleFetch(endpoint,token,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:'28daysAgo',endDate:'yesterday'}],dimensions:[{name:'country'},{name:'countryId'}],metrics:[{name:'activeUsers'},{name:'sessions'}],limit:100,orderBys:[{metric:{metricName:'sessions'},desc:true}]})})
  ]);
  if(!dailyResponse.ok||!pagesResponse.ok||!countriesResponse.ok)return NextResponse.json({error:'GA4 Data API returned an error; verify it is enabled and you have read access'},{status:502});
  const daily=await dailyResponse.json(),pages=await pagesResponse.json(),countries=await countriesResponse.json();
  const result=NextResponse.json({daily:daily.rows||[],pages:pages.rows||[],countries:countries.rows||[],property,period,country,quota:daily.propertyQuota||null},{headers:{'Cache-Control':'private, no-store'}});
  if(updated)result.cookies.set(SESSION_COOKIE,encrypt(updated),cookieOptions);
  return result;
 }catch{return NextResponse.json({error:'Unable to retrieve Google Analytics data; reconnect and try again'},{status:502})}
}
