import {NextRequest,NextResponse} from 'next/server';
import {deviceFromAuthorization,sb} from '@/lib/device-relay';
export const runtime='nodejs';
export async function GET(req:NextRequest){
  const device=await deviceFromAuthorization(req.headers.get('authorization'));
  if(!device)return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
  try{
    const rows=await sb<Array<{id:string;tool:string;agent_name:string;ok:boolean;at:string;request_debug:Record<string,unknown>|null}>>(
      '/rest/v1/cmg_mcp_calls?user_id=eq.'+encodeURIComponent(device.user_id)+'&select=id,tool,agent_name,ok,at,request_debug&order=at.desc&limit=30');
    return NextResponse.json({calls:rows.map(r=>({id:r.id,tool:r.tool,agentName:r.agent_name,ok:r.ok,at:r.at,requestDebug:r.request_debug}))},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'History unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
