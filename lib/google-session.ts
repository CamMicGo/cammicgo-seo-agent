import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {cookies} from 'next/headers';
export const SESSION_COOKIE='cmg_google_session';
export const STATE_COOKIE='cmg_oauth_pending';
export type Credentials={clientId:string;clientSecret:string;mode:'shared'|'byo'};
export type GoogleSession={credentials:Credentials;accessToken:string;refreshToken?:string;expiresAt:number};
export type Pending={state:string;verifier:string;credentials:Credentials;issuedAt:number};
function key(){const raw=process.env.SESSION_ENCRYPTION_KEY;if(!raw)throw new Error('SESSION_ENCRYPTION_KEY not configured');const v=Buffer.from(raw,'base64');if(v.length!==32)throw new Error('Invalid SESSION_ENCRYPTION_KEY');return v}
export function encrypt(payload:object){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64url')).join('.')}
export function decrypt<T>(raw:string|undefined):T|null{if(!raw)return null;try{const [i,t,b]=raw.split('.');if(!i||!t||!b)return null;const d=createDecipheriv('aes-256-gcm',key(),Buffer.from(i,'base64url'));d.setAuthTag(Buffer.from(t,'base64url'));return JSON.parse(Buffer.concat([d.update(Buffer.from(b,'base64url')),d.final()]).toString('utf8')) as T}catch{return null}}
export const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge:60*60*24*7};
export async function getSession(){const jar=await cookies();return decrypt<GoogleSession>(jar.get(SESSION_COOKIE)?.value)}
export async function getCredentials(session:GoogleSession){return session.credentials}
export async function authorizedAccessToken(session:GoogleSession):Promise<{token:string;updated?:GoogleSession}>{if(Date.now()+60_000<session.expiresAt)return {token:session.accessToken};if(!session.refreshToken)throw new Error('Google session expired; reconnect');const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:session.credentials.clientId,client_secret:session.credentials.clientSecret,refresh_token:session.refreshToken,grant_type:'refresh_token'}),cache:'no-store'});if(!response.ok)throw new Error('Google token refresh failed; reconnect');const json=await response.json();const updated={...session,accessToken:json.access_token as string,expiresAt:Date.now()+Number(json.expires_in||3600)*1000};return {token:updated.accessToken,updated}}
export async function googleFetch(url:string,token:string,init?:RequestInit){return fetch(url,{...init,headers:{...init?.headers,Authorization:'Bearer '+token},cache:'no-store'})}
