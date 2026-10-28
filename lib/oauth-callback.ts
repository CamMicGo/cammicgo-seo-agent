/** Server-controlled OAuth callback: never derive from arbitrary Host headers or user input. */
export function googleOAuthCallback(){
 const configured=process.env.APP_BASE_URL||'https://seo.cammicgo.com';
 const origin=new URL(configured);
 const local=['localhost','127.0.0.1'].includes(origin.hostname);
 if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||(!local&&origin.protocol!=='https:')||(local&&origin.protocol!=='http:'))throw new Error('Invalid APP_BASE_URL: use HTTPS or HTTP localhost origin');
 return origin.origin+'/api/auth/google/callback';
}
