import {NextRequest,NextResponse} from 'next/server';
import {completePairing} from '@/lib/device-relay';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
/** The Android app exchanges a one-time pairing code (shown by the MCP tool device_pairing_code) for a device token. */
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>null) as {code?:unknown;name?:unknown}|null;
 if(!body||typeof body.code!=='string')return NextResponse.json({error:'Pairing code required'},{status:400,headers:noStore});
 const name=typeof body.name==='string'?body.name.replace(/[^\p{L}\p{N} ._()-]/gu,'').trim():'Android';
 try{
  const paired=await completePairing(body.code,name||'Android');
  if(!paired)return NextResponse.json({error:'Code invalide, expiré ou déjà utilisé. Demandez un nouveau code à votre assistant IA (outil device_pairing_code).'},{status:400,headers:noStore});
  return NextResponse.json({deviceToken:paired.token,deviceId:paired.device.id,name:paired.device.name},{headers:noStore});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Pairing unavailable'},{status:503,headers:noStore})}
}
