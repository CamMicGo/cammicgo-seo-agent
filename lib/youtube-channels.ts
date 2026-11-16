/**
 * Choice of the user's YouTube channel for tools about their own channel (pure, testable).
 * Several channels and none named: the assistant must ask the user; it never guesses.
 */
export type ChannelOption={id:string;title:string|null};
export function pickChannel<T extends ChannelOption>(opts:T[],channel?:string):{pick:T}|{status:'none'|'ask'|'unknown'}{
 if(!opts.length)return {status:'none'};
 if(channel){
  const q=channel.trim().toLowerCase().replace(/^@/,'');
  const t=(o:T)=>(o.title??'').toLowerCase();
  const pick=opts.find(o=>o.id.toLowerCase()===q)??opts.find(o=>t(o)===q)??(q.length>=3?opts.filter(o=>t(o).includes(q)):[]).find((_,i,a)=>a.length===1);
  return pick?{pick}:{status:'unknown'};
 }
 return opts.length===1?{pick:opts[0]}:{status:'ask'};
}
