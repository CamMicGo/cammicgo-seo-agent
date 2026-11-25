/**
 * Photos the phone did not turn into thumbnails (it makes at most 150, and none when the extraction was
 * stopped or saved by the server) are copied from LinkedIn's image CDN by the server: small profile photos
 * only, kept 24 hours like the others. The reader's browser never loads anything from LinkedIn.
 */
export async function copyCdnPhotos(cards:Array<Record<string,unknown>>,base:string,store:(b64:string[])=>Promise<string[]>,fetchFn:typeof fetch=fetch,max=600){
 const isHosted=(u:unknown)=>typeof u==='string'&&u.startsWith(base+'/api/linkedin/thumb/');
 const cdn=(c:Record<string,unknown>)=>[c.imageUrl,c.photoUrl,c.linkedinImageUrl,c.linkedinPhotoUrl,c.authorPhotoUrl].find(u=>typeof u==='string'&&/^https:\/\/media\.licdn\.com\/dms\/image\//.test(u)) as string|undefined;
 const todo=cards.filter(c=>!isHosted(c.imageUrl)&&!isHosted(c.photoUrl)&&!isHosted(c.authorPhotoUrl)&&cdn(c)).slice(0,max);
 if(!todo.length)return 0;
 const byUrl=new Map<string,Array<Record<string,unknown>>>();
 for(const c of todo){const u=cdn(c)!;byUrl.set(u,[...(byUrl.get(u)||[]),c]);}
 const urls=[...byUrl.keys()];let done=0;
 for(let i=0;i<urls.length;i+=16){
  const got=await Promise.all(urls.slice(i,i+16).map(async u=>{try{const r=await fetchFn(u,{signal:AbortSignal.timeout(5000),redirect:'error'});const type=(r.headers.get('content-type')||'').split(';')[0];if(!r.ok||!/^image\/(jpeg|png|webp)$/.test(type))return null;const b=Buffer.from(await r.arrayBuffer());return b.length&&b.length<=40000?{u,b64:b.toString('base64')}:null;}catch{return null;}}));
  const ok=got.filter((x):x is {u:string;b64:string}=>!!x);
  if(!ok.length)continue;
  const ids=await store(ok.map(x=>x.b64)).catch(()=>[] as string[]);
  ok.forEach((x,k)=>{const id=ids[k];if(!id)return;for(const c of byUrl.get(x.u)||[]){if(typeof c.imageUrl==='string'&&!isHosted(c.imageUrl))c.linkedinImageUrl=c.imageUrl;c.imageUrl=base+'/api/linkedin/thumb/'+id+'.jpg';if(c.authorPhotoUrl&&!isHosted(c.authorPhotoUrl))c.authorPhotoUrl=c.imageUrl;}done++;});
 }
 return done;
}
