import {NextRequest,NextResponse} from 'next/server';
import {SESSION_COOKIE,STATE_COOKIE,cookieOptions} from '@/lib/google-session';
export async function POST(req:NextRequest){const origin=req.headers.get('origin');if(origin&&origin!==req.nextUrl.origin)return NextResponse.json({error:'Invalid origin'},{status:403});const r=NextResponse.redirect(new URL('/connect',req.url),303);r.cookies.set(SESSION_COOKIE,'',{...cookieOptions,maxAge:0});r.cookies.set(STATE_COOKIE,'',{...cookieOptions,maxAge:0});return r}
