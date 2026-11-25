import {createHmac,timingSafeEqual} from 'node:crypto';
/**
 * Profile photos without a phone-made thumbnail are shown through /api/linkedin/photo: the server fetches the
 * photo from LinkedIn's image CDN when the report is opened, so the reader's browser never contacts LinkedIn
 * and nothing is stored. Only links signed by this server are served (no open proxy).
 */
const key=()=>createHmac('sha256','cmg-linkedin-photo').update(process.env.LINKEDIN_PHOTO_SECRET||process.env.SUPABASE_SECRET_KEY||'').digest();
export const isLinkedInPhoto=(u:unknown):u is string=>typeof u==='string'&&u.length<=1200&&/^https:\/\/media\.licdn\.com\/dms\/image\/[^\s"'<>]+$/.test(u);
export function signPhoto(u:string){return createHmac('sha256',key()).update(u).digest('base64url').slice(0,32);}
export function verifyPhoto(u:string,s:string){if(!isLinkedInPhoto(u)||typeof s!=='string'||s.length!==32)return false;const a=Buffer.from(signPhoto(u)),b=Buffer.from(s);return a.length===b.length&&timingSafeEqual(a,b);}
export function photoProxyUrl(base:string,u:string){return isLinkedInPhoto(u)?base+'/api/linkedin/photo?u='+encodeURIComponent(u)+'&s='+signPhoto(u):'';}
/** Cards without a hosted photo get the proxied LinkedIn photo (no download now). */
export function proxyMissingPhotos(cards:Array<Record<string,unknown>>,base:string){
 const hosted=(u:unknown)=>typeof u==='string'&&u.startsWith(base+'/');
 let n=0;
 for(const c of cards){
  if(hosted(c.imageUrl))continue;
  const src=[c.imageUrl,c.photoUrl,c.authorPhotoUrl,c.linkedinImageUrl,c.linkedinPhotoUrl].find(isLinkedInPhoto);
  if(!src)continue;
  if(typeof c.imageUrl==='string'&&c.imageUrl)c.linkedinImageUrl=c.imageUrl;
  c.imageUrl=photoProxyUrl(base,src);n++;
 }
 return n;
}
