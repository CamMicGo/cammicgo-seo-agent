import {NextRequest,NextResponse} from 'next/server';
import {decrypt,cookieOptions} from '@/lib/google-session';
import {saveLinkedInConnection,socialClient} from '@/lib/social-store';
import {LI_API,LI_TOKEN,tokenBody,type LinkedInSession} from '@/lib/linkedin';
export const runtime='nodejs';
const STATE_COOKIE='cmg_li_pending';

/** LinkedIn OAuth callback: exchanges the code with the user's own app, reads the member ID, stores the token encrypted. */
export async function GET(req:NextRequest){
 const back=(status:string)=>{const r=NextResponse.redirect(new URL('/account?linkedin='+status,req.url));r.cookies.set(STATE_COOKIE,'',{...cookieOptions,maxAge:0});return r;};
 const pending=decrypt<{state:string;userId:string;issuedAt:number}>(req.cookies.get(STATE_COOKIE)?.value);
 const q=req.nextUrl.searchParams;
 if(q.get('error'))return back('denied');
 if(!pending||q.get('state')!==pending.state||Date.now()-pending.issuedAt>600_000||!q.get('code'))return back('expired');
 const client=await socialClient(pending.userId,'linkedin');if(!client)return back('error');
 const t=await fetch(LI_TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:tokenBody(q.get('code')!,client.clientId,client.clientSecret),cache:'no-store'});
 const tok=await t.json().catch(()=>({})) as {access_token?:string;expires_in?:number;scope?:string};
 if(!t.ok||!tok.access_token)return back('error');
 const me=await fetch(LI_API+'/userinfo',{headers:{Authorization:'Bearer '+tok.access_token},cache:'no-store'});
 const info=await me.json().catch(()=>({})) as {sub?:string;name?:string;email?:string};
 if(!me.ok||!info.sub)return back('error');
 const session:LinkedInSession={accessToken:tok.access_token,expiresAt:Date.now()+Number(tok.expires_in||5_184_000)*1000,scopes:(tok.scope??'').split(/[ ,]+/).filter(Boolean),memberId:info.sub,name:info.name??'LinkedIn member',email:info.email??null};
 try{await saveLinkedInConnection(pending.userId,session);}catch{return back('error');}
 return back('connected');
}
