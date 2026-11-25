/**
 * A company's post is found on its own page (/company/<slug>/posts/) instead of LinkedIn's search, which
 * free accounts can only use a limited number of times a month (people search, "unlimited search" banner).
 */
type Post={postUrl?:unknown;time?:unknown;text?:unknown;[k:string]:unknown};

/** Age of a post from LinkedIn's relative time ("2 h", "3 j", "1 sem", "2 mo", "1 an", "5d", "1w"…), in minutes. */
export function ageMinutes(time:unknown):number{
 const t=String(time??'').toLowerCase().replace(/\s+/g,' ').trim();
 const m=t.match(/(\d+)\s*([a-zà-ÿ]+)/);
 if(!m)return /now|maintenant|instant|à l.instant/.test(t)?0:Infinity;
 const n=Number(m[1]),u=m[2];
 const table:Array<[RegExp,number]>=[[/^(sem|w|wk|week|wo|set)/,10080],[/^(mo|mois|month|mes|mon)/,43200],[/^(mi|min|m)$|^min/,1],[/^(h|hr|heure|hour|std|ore)/,60],
  [/^(j|d|day|jour|tag|dí|gi|dia)/,1440],[/^(a|y|yr|year|an|jahr|ano|año)/,525600],[/^(s|sec|seg|sek)/,1/60]];
 const unit=(table.find(([re])=>re.test(u))||[null,Infinity])[1];
 return n*unit;
}
const words=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(/[^a-z0-9]+/).filter(w=>w.length>2);

/** The most recent post, or the best match for the keywords (then the most recent). Pinned posts lose to newer ones. */
export function pickPost(posts:unknown,keywords=''):Post|null{
 const list=(Array.isArray(posts)?posts:[]).filter((p):p is Post=>!!p&&typeof p==='object'&&typeof (p as Post).postUrl==='string'&&!!(p as Post).postUrl);
 if(!list.length)return null;
 const kw=words(keywords);
 const score=(p:Post)=>{const w=new Set(words(String(p.text??'')));return kw.filter(k=>w.has(k)).length;};
 return list.map((p,i)=>({p,i,s:kw.length?score(p):0,a:ageMinutes(p.time)})).sort((x,y)=>y.s-x.s||x.a-y.a||x.i-y.i)[0].p;
}

/** Company slug from a company link, a slug, or a name ("Mistral AI" → "mistralai", a best guess). */
export function companySlug(v:string):string{
 const s=String(v||'').trim();if(!s)return '';
 const m=s.match(/linkedin\.com\/company\/([^/?#]+)/i);
 if(m)return /^[A-Za-z0-9%._-]{1,150}$/.test(m[1])?m[1]:'';
 if(/^[A-Za-z0-9._-]{1,150}$/.test(s))return s.toLowerCase();
 return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'').slice(0,150);
}
