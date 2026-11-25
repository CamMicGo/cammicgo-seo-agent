/**
 * Big extractions: the phone saves the reacting people in batches of 50 while it reads (stored with the
 * report, deleted with it). The final answer from the phone is capped in size, so the server puts every saved
 * person back into the result before the report is built: nobody read is lost.
 */
type O=Record<string,unknown>;
const key=(p:O)=>String(p.profileUrl||'').split(/[?#]/)[0].replace(/\/+$/,'').toLowerCase()||'name:'+String(p.name||'').trim().toLowerCase();
export function mergeReactionPeople(result:unknown,saved:O[]):unknown{
 if(!result||typeof result!=='object'||!saved.length)return result;
 const root=result as O;
 const rx=(root.reactions&&typeof root.reactions==='object'?root.reactions:(root.reactions={people:[]})) as O;
 const people=Array.isArray(rx.people)?rx.people as O[]:(rx.people=[] as O[]) as O[];
 const index=new Map<string,O>();
 for(const p of people)if(p&&typeof p==='object')index.set(key(p),p);
 let added=0;
 for(const p of saved){
  if(!p||typeof p!=='object'||(!p.profileUrl&&!p.name))continue;
  const k=key(p);if(k==='name:')continue;
  const old=index.get(k);
  if(old){for(const f of ['headline','reaction','photoUrl'])if(!old[f]&&p[f])old[f]=p[f];continue;}
  const q:O={};for(const f of ['name','profileUrl','headline','reaction','photoUrl'])if(p[f]!=null&&p[f]!=='')q[f]=p[f];
  people.push(q);index.set(k,q);added++;
 }
 if(!added)return result;
 const by:Record<string,number>={};for(const p of people){const t=String(p.reaction||'unknown');by[t]=(by[t]||0)+1;}
 rx.byType=by;rx.retrieved=people.length;rx.restoredFromBatches=added;
 const exp=typeof rx.expectedTotal==='number'?rx.expectedTotal:null;
 const anon=typeof rx.anonymousRows==='number'?rx.anonymousRows:0;
 if(exp!=null&&people.length+anon>=exp&&rx.stopped!==true){rx.complete=true;rx.partial=false;rx.missing=[];}
 const cons=root.consistency&&typeof root.consistency==='object'?root.consistency as O:null;
 if(cons){cons.reactionsRead=people.length;cons.reactionsComplete=rx.complete??null;}
 if(root.truncated)root.peopleRestored=true;
 return result;
}
