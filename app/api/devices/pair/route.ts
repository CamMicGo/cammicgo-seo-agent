import {NextRequest,NextResponse} from 'next/server';
import {completePairing,PAIRING_MAX_FAILURES,recentPairingFailures,recordPairingFailure} from '@/lib/device-relay';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
/** The Android app exchanges a one-time pairing code (shown by the MCP tool device_pairing_code) for a device token. */
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null) as {code?:unknown;name?:unknown}|null;
 if(!body||typeof body.code!=='string')return NextResponse.json({error:'Pairing code required'},{status:400,headers:noStore});
 const name=typeof body.name==='string'?body.name.replace(/[^\p{L}\p{N} ._()-]/gu,'').trim():'Android';
 const ip=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim()||req.headers.get('x-real-ip')||'unknown';
 try{
  if(await recentPairingFailures(ip)>=PAIRING_MAX_FAILURES)return NextResponse.json({error:'Trop d’essais. Réessayez dans 15 minutes.'},{status:429,headers:noStore});
  const paired=await completePairing(body.code,name||'Android');
  if(!paired)await recordPairingFailure(ip);
  if(!paired)return NextResponse.json({error:'Code invalide, expiré ou déjà utilisé. Demandez un nouveau code à votre assistant IA (outil device_pairing_code).'},{status:400,headers:noStore});
  return NextResponse.json({deviceToken:paired.token,deviceId:paired.device.id,name:paired.device.name},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Pairing unavailable'},{status:503,headers:noStore})}
}
