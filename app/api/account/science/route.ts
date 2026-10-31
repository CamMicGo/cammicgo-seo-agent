import {NextRequest,NextResponse} from 'next/server';
import {verifySupabaseMcpUser} from '@/lib/supabase-mcp-auth';
import {deleteKey,isProvider,keySummaries,saveKey,validateKey,verifyKey} from '@/lib/science-keys';
export const runtime='nodejs';
const noStore={'Cache-Control':'no-store'};
const sameOrigin=(req:NextRequest)=>{const o=req.headers.get('origin');return !o||o===req.nextUrl.origin;};
const user=(req:NextRequest)=>verifySupabaseMcpUser(req.headers.get('authorization'));

/** Saved science API keys of the signed-in user (hints only). */
export async function GET(req:NextRequest){
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 try{return NextResponse.json({keys:await keySummaries(u.id)},{headers:noStore});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore})}
}

/** Saves one key after asking the provider whether it works. */
export async function POST(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'origin'},{status:403,headers:noStore});
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 const body=await req.json().catch(()=>({})) as {provider?:unknown;key?:unknown};
 if(!isProvider(body.provider))return NextResponse.json({error:'invalid_provider'},{status:400,headers:noStore});
 const key=validateKey(body.key);if(!key)return NextResponse.json({error:'invalid_key_format'},{status:400,headers:noStore});
 const check=await verifyKey(body.provider,key);
 if(check==='invalid')return NextResponse.json({error:'key_rejected'},{status:400,headers:noStore});
 try{await saveKey(u.id,body.provider,key,check==='ok');return NextResponse.json({ok:true,verified:check==='ok',keys:await keySummaries(u.id)},{headers:noStore});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore})}
}

export async function DELETE(req:NextRequest){
 if(!sameOrigin(req))return NextResponse.json({error:'origin'},{status:403,headers:noStore});
 const u=await user(req);if(!u)return NextResponse.json({error:'unauthorized'},{status:401,headers:noStore});
 const provider=req.nextUrl.searchParams.get('provider');
 if(!isProvider(provider))return NextResponse.json({error:'invalid_provider'},{status:400,headers:noStore});
 try{await deleteKey(u.id,provider);return NextResponse.json({ok:true,keys:await keySummaries(u.id)},{headers:noStore});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'unavailable'},{status:503,headers:noStore})}
}
