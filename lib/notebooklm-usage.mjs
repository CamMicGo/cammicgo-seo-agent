/** Decode NotebookLM account usage responses, following Jacob BD's documented
 * ozz5Z (tier) and EylDcb (remaining compute) RPC shapes.
 * The authenticated on-device transport must call these RPCs separately.
 * Never infer usage from the number of generated audio/video artifacts.
 */
const TIERS={
 NOTEBOOKLM_TIER_STANDARD:'Standard',
 NOTEBOOKLM_TIER_PLUS:'Plus',
 NOTEBOOKLM_TIER_PRO:'Pro',
 NOTEBOOKLM_TIER_PRO_CONSUMER_USER:'Pro',
 NOTEBOOKLM_TIER_PRO_DASHER_END_USER:'Workspace Pro',
 NOTEBOOKLM_TIER_ULTRA:'Ultra'
};
export function parseNotebookUsage(payload,{tier=null}={}){
 const windows=payload?.[1];
 if(!Array.isArray(windows))throw new Error('NotebookLM usage response unavailable');
 const parsed=[];
 for(const item of windows){
  if(!Array.isArray(item))continue;
  const kind=item[4]===1?'rolling':item[4]===2?'weekly':null;
  if(!kind)continue;
  const remaining=item[7],used=item[6];
  const seconds=item[5]?.[0];
  if(typeof remaining!=='number'||!Number.isFinite(remaining)||remaining<0||remaining>100||!Number.isFinite(seconds))throw new Error('Invalid NotebookLM usage window');
  parsed.push({window:kind,percent_used:typeof used==='number'?used:100-remaining,percent_remaining:remaining,resets_at:new Date(seconds*1000).toISOString()});
 }
 if(!parsed.length)throw new Error('No NotebookLM quota windows found');
 parsed.sort((a,b)=>(a.window==='rolling'?0:1)-(b.window==='rolling'?0:1));
 return {tier:tier&&TIERS[tier]?tier:null,tier_label:tier&&TIERS[tier]?TIERS[tier]:null,windows:parsed,source:'notebooklm-account-rpc',is_estimate:false};
}
export function notebookUsageGuidance(result){
 if(!result?.windows?.length)return {canGenerate:null,reason:'Quota not verified'};
 const remaining=Math.min(...result.windows.map(w=>w.percent_remaining));
 return {canGenerate:remaining>0?null:false,reason:remaining<=0?'Compute quota exhausted':'Quota remains, but generation is not guaranteed'};
}
