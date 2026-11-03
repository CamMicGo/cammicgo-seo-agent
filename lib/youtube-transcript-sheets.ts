/** Google Sheets storage for timestamped YouTube transcripts.
 * Uses the user's OAuth access token; no transcript is persisted to Supabase.
 * The caller must request the separate spreadsheets scope.
 */
export const SHEETS_SCOPE='https://www.googleapis.com/auth/spreadsheets';
export const TRANSCRIPT_HEADERS=['channel_name','channel_id','author','video_title','video_id','published_at','video_url','language','transcript','extracted_at'];
export type TranscriptSheetRow={channel_name:string;channel_id:string;author:string;video_title:string;video_id:string;published_at:string;video_url:string;language:string;transcript:string;extracted_at:string};
const API='https://sheets.googleapis.com/v4/spreadsheets';
async function call(token:string,url:string,init:RequestInit={}):Promise<Record<string, unknown>>{
 const res=await fetch(url,{...init,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...init.headers},cache:'no-store'});
 const data=await res.json().catch(()=>({})) as Record<string, unknown>;
 if(!res.ok)throw new Error('Google Sheets HTTP '+res.status+': '+String((data.error as {message?:string}|undefined)?.message||'request failed'));
 return data;
}
const range=(id:string,a1:string)=>API+'/'+encodeURIComponent(id)+'/values/'+encodeURIComponent(a1);
export async function createChannelSheet(token:string,channelName:string){
 const title=('YouTube — '+channelName).slice(0,100);
 const doc=await call(token,API,{method:'POST',body:JSON.stringify({properties:{title},sheets:[{properties:{title:'Transcriptions',gridProperties:{frozenRowCount:1}}}]})});
 await call(token,range(doc.spreadsheetId,'Transcriptions!A1:J1')+'?valueInputOption=RAW',{method:'PUT',body:JSON.stringify({values:[TRANSCRIPT_HEADERS]})});
 return {spreadsheetId:String(doc.spreadsheetId),url:String(doc.spreadsheetUrl)};
}
export function sheetValues(row:TranscriptSheetRow){return TRANSCRIPT_HEADERS.map(k=>row[k as keyof TranscriptSheetRow]||'')}
export async function upsertChannelRows(token:string,spreadsheetId:string,rows:TranscriptSheetRow[]){
 if(!/^[a-zA-Z0-9_-]{10,200}$/.test(spreadsheetId))throw Error('Invalid spreadsheet ID');
 const existing=await call(token,range(spreadsheetId,'Transcriptions!A1:J')+'?majorDimension=ROWS');
 const values:string[][]=Array.isArray(existing.values)?existing.values as string[][]:[];
 if(values.length&&TRANSCRIPT_HEADERS.some((v,i)=>values[0]?.[i]!==v))throw Error('Unexpected sheet columns; refusing overwrite');
 const indexes=new Map<string,number>();
 for(let i=1;i<values.length;i++){const id=values[i]?.[4];if(id)indexes.set(id,i+1)}
 const unique=new Map(rows.map(r=>[r.video_id,r]));
 let added=0,updated=0,unchanged=0;
 const writes:Array<{range:string;values:string[][]}>=[];
 for(const row of unique.values()){
  if(!/^[a-zA-Z0-9_-]{11}$/.test(row.video_id))throw Error('Invalid video ID');
  const cells=sheetValues(row);const at=indexes.get(row.video_id);
  if(at){if(JSON.stringify(values[at-1])===JSON.stringify(cells)){unchanged++;continue}
   writes.push({range:'Transcriptions!A'+at+':J'+at,values:[cells]});updated++;
  }else{writes.push({range:'Transcriptions!A'+(values.length+added+1)+':J'+(values.length+added+1),values:[cells]});added++}
 }
 if(writes.length)await call(token,API+'/'+encodeURIComponent(spreadsheetId)+'/values:batchUpdate',{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data:writes})});
 return {spreadsheetId,added,updated,unchanged,total:values.length-1+added};
}
