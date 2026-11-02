/** Google Docs live source for NotebookLM personal accounts.
 * Calls official Drive/Docs REST APIs using a short-lived, user-authorized OAuth access token.
 * Never persist access tokens or send them to NotebookLM's unofficial RPC service.
 */
const DRIVE='https://www.googleapis.com/drive/v3/files';
const DOCS='https://docs.googleapis.com/v1/documents';
async function google(url,token,init={}){
 if(typeof token!=='string'||!token)throw Error('Google OAuth access token required');
 const response=await fetch(url,{...init,headers:{Authorization:'Bearer '+token,...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}});
 if(!response.ok){const body=(await response.text()).slice(0,350);throw Error('Google API HTTP '+response.status+': '+body);}
 return response.status===204?null:response.json();
}
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{10,200}$/.test(id);
export async function createLiveDoc({accessToken,title}){
 if(!String(title||'').trim())throw Error('Document title required');
 const doc=await google(DOCS,accessToken,{method:'POST',body:JSON.stringify({title})});
 return {documentId:doc.documentId,title:doc.title,webViewLink:'https://docs.google.com/document/d/'+doc.documentId+'/edit'};
}
export async function replaceLiveDoc({accessToken,documentId,markdown}){
 if(!validId(documentId))throw Error('Invalid Google Doc ID');
 if(typeof markdown!=='string'||!markdown.trim())throw Error('Nonempty Markdown required');
 const doc=await google(DOCS+'/'+encodeURIComponent(documentId),accessToken);
 const end=doc.body?.content?.at(-1)?.endIndex??1;
 const requests=[];
 if(end>2)requests.push({deleteContentRange:{range:{startIndex:1,endIndex:end-1}}});
 requests.push({insertText:{location:{index:1},text:markdown}});
 await google(DOCS+'/'+encodeURIComponent(documentId)+':batchUpdate',accessToken,{method:'POST',body:JSON.stringify({requests})});
 return {documentId,characters:markdown.length,webViewLink:'https://docs.google.com/document/d/'+documentId+'/edit'};
}
export async function findLiveDocs({accessToken,name}){
 const q="name = '"+String(name).replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"' and mimeType = 'application/vnd.google-apps.document' and trashed = false";
 const u=new URL(DRIVE);u.searchParams.set('q',q);u.searchParams.set('fields','nextPageToken,files(id,name,webViewLink,modifiedTime)');u.searchParams.set('pageSize','100');
 const result=await google(u.toString(),accessToken);
 return result.files||[];
}
