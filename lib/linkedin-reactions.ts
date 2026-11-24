export const REACTION_TYPES=['like','celebrate','support','love','insightful','funny'] as const;
const REACTION_LABELS:Record<string,string>={like:'J’aime',celebrate:'Bravo',support:'Soutien',love:'J’adore',insightful:'Instructif',funny:'Drôle'};
/** LinkedIn's six reaction pictures, served by CamMicGo: reactionIconUrl on each person, reactionIcons per type. */
export function decorateReactions(data:unknown,base=process.env.APP_BASE_URL||'https://seo.cammicgo.com'){
 const icon=(t:string)=>base+'/linkedin/reactions/'+t+'.png';
 const isType=(t:unknown):t is string=>typeof t==='string'&&(REACTION_TYPES as readonly string[]).includes(t);
 const visit=(node:unknown,depth:number)=>{
  if(depth>6||!node||typeof node!=='object')return;
  if(Array.isArray(node)){for(const c of node)visit(c,depth+1);return;}
  const o=node as Record<string,unknown>;
  if(isType(o.reaction)){o.reactionIconUrl=icon(o.reaction);o.reactionLabel=REACTION_LABELS[o.reaction];}
  if(o.byType&&typeof o.byType==='object'&&Array.isArray(o.people)){const icons:Record<string,string>={};for(const t of Object.keys(o.byType as object))if(isType(t))icons[t]=icon(t);o.reactionIcons=icons;}
  for(const k of Object.keys(o))if(o[k]&&typeof o[k]==='object')visit(o[k],depth+1);
 };
 visit(data,0);
 return data;
}
