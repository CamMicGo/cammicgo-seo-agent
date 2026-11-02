/** Local-only NotebookLM personal browser client.
 * Uses a user-owned Chromium profile and Playwright (optional install).
 * No Google cookies or browser tokens are sent to CamMicGo servers.
 * NotebookLM has no stable public personal-account API; browser UI selectors may change.
 */
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
const PROFILE=join(homedir(),'.cammicgo-seo-agent','notebooklm-browser');
const SITE='https://notebooklm.google.com/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(){
 let chromium;
 try{({chromium}=await import('playwright'))}catch{throw Error('Playwright missing. Install locally with npm install --no-save playwright && npx playwright install chromium')}
 await mkdir(PROFILE,{recursive:true,mode:0o700});
 return chromium.launchPersistentContext(PROFILE,{headless:false,viewport:{width:1280,height:900}});
}
async function firstVisible(page,selectors){
 for(const selector of selectors){const loc=page.locator(selector).first();if(await loc.isVisible().catch(()=>false))return loc}
 return null;
}
export async function createPersonalNotebook({title,googleDocUrl,timeoutMs=120000}){
 if(!String(title||'').trim())throw Error('Notebook title required');
 if(googleDocUrl&&!/^https:\/\/docs\.google\.com\/document\/d\/[A-Za-z0-9_-]+\//.test(googleDocUrl))throw Error('Expected Google Docs URL');
 const context=await launch();
 try{
  const page=context.pages()[0]||await context.newPage();
  await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:30000});
  const deadline=Date.now()+timeoutMs;
  let create;
  while(Date.now()<deadline){
   create=await firstVisible(page,['button:has-text("Create new")','button:has-text("New notebook")','button:has-text("Créer")','[role="button"]:has-text("Create new")','[role="button"]:has-text("Nouveau notebook")']);
   if(create)break;
   await sleep(1500);
  }
  if(!create)throw Error('NotebookLM creation button unavailable; sign in to Google in the local browser and retry.');
  await create.click();
  await page.waitForURL(u=>u.origin==='https://notebooklm.google.com'&&u.pathname!=='/',{timeout:30000}).catch(()=>{});
  const url=page.url();
  if(!/^https:\/\/notebooklm\.google\.com\/notebook\/[A-Za-z0-9_-]+/.test(url))throw Error('Could not confirm notebook creation. UI may have changed.');
  const notebookTitle=await firstVisible(page,['button[aria-label*="rename" i]','button[aria-label*="renommer" i]','[role="button"][aria-label*="rename" i]']);
  if(notebookTitle)await notebookTitle.click();
  const edit=await firstVisible(page,['input[aria-label*="title" i]','input[aria-label*="titre" i]','[contenteditable="true"][aria-label*="title" i]','[contenteditable="true"][aria-label*="titre" i]']);
  let renamed=false;
  if(edit){await edit.fill(title);await edit.press('Enter');renamed=true}
  let sourceAttached=false,sourceError=null;
  if(googleDocUrl){
   try{
    const add=await firstVisible(page,['button:has-text("Add sources")','button:has-text("Add source")','button:has-text("Ajouter des sources")','button:has-text("Ajouter une source")','[role="button"]:has-text("Add sources")','[role="button"]:has-text("Ajouter des sources")']);
    if(!add)throw Error('Add source button not found');
    await add.click();
    const drive=await firstVisible(page,['button:has-text("Google Drive")','[role="button"]:has-text("Google Drive")','button:has-text("Drive")','[role="button"]:has-text("Drive")']);
    if(!drive)throw Error('Google Drive source picker not found');
    await drive.click();
    // The Google Drive picker cannot be safely automated without verifying the
    // live DOM and account. Never report an attachment that has not been confirmed.
    sourceError='Google Drive picker opened; document selection requires a validated interactive session.';
   }catch(e){sourceError=String(e.message||e)}
  }
  // Verify the new notebook is visible in the authenticated account before reporting success.
  // A URL alone does not prove that NotebookLM saved the notebook or its requested title.
  await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:30000});
  const notebookLink=page.locator('a[href*="/notebook/"]').filter({hasText:title.trim()}).first();
  const listed=await notebookLink.waitFor({state:'visible',timeout:10000}).then(()=>true).catch(()=>false);
  const listedUrl=listed?await notebookLink.getAttribute('href'):null;
  const expectedId=url.match(/\/notebook\/([A-Za-z0-9_-]+)/)?.[1];
  const matches=!!(listed&&expectedId&&listedUrl?.includes('/notebook/'+expectedId));
  return {notebookUrl:url,notebookCreated:matches,titleSet:renamed&&matches,sourceAttached,googleDocUrl:googleDocUrl||null,sourceError,verifiedInList:matches,note:matches?'Created notebook and verified its exact title in the NotebookLM list.':'Notebook URL was opened but its exact title could not be confirmed in the NotebookLM list; do not report success.'};
 }finally{await context.close()}
}

/** List notebooks from the authenticated local browser. Never sends browser credentials to the MCP server. */
export async function listPersonalNotebooks({timeoutMs=120000}={}){
 const context=await launch();
 try{
  const page=context.pages()[0]||await context.newPage();
  await page.goto(SITE,{waitUntil:'domcontentloaded',timeout:30000});
  const deadline=Date.now()+timeoutMs;
  let cards=[];
  while(Date.now()<deadline){
   cards=await page.locator('a[href*="/notebook/"]').evaluateAll(nodes=>nodes.map(a=>({
    title:(a.getAttribute('aria-label')||a.innerText||'').trim(),
    url:a.href
   })).filter(n=>/^https:\/\/notebooklm\.google\.com\/notebook\/[A-Za-z0-9_-]+/.test(n.url)&&n.title));
   if(cards.length)break;
   if(await firstVisible(page,['button:has-text("Create new")','button:has-text("New notebook")','button:has-text("Créer")','button:has-text("Nouveau notebook")']))break;
   await sleep(1000);
  }
  if(!cards.length&&!await firstVisible(page,['button:has-text("Create new")','button:has-text("New notebook")','button:has-text("Créer")','button:has-text("Nouveau notebook")']))throw Error('NotebookLM sign-in or notebook listing not verified');
  return {notebooks:[...new Map(cards.map(n=>[n.url,n])).values()],count:cards.length,source:'local authenticated NotebookLM browser'};
 }finally{await context.close()}
}
/** Read notebook title only when the exact notebook URL is confirmed. */
export async function readPersonalNotebook({notebookUrl}){
 if(!/^https:\/\/notebooklm\.google\.com\/notebook\/[A-Za-z0-9_-]+\/?$/.test(notebookUrl))throw Error('Invalid NotebookLM notebook URL');
 const context=await launch();
 try{
  const page=context.pages()[0]||await context.newPage();
  await page.goto(notebookUrl,{waitUntil:'domcontentloaded',timeout:30000});
  if(!page.url().startsWith(notebookUrl.replace(/\/$/,'')))throw Error('Notebook not accessible in local Google session');
  const title=await page.title();
  return {notebookUrl,title,verified:true,note:'Browser page title, not necessarily the editable notebook name'};
 }finally{await context.close()}
}

/** Rename an existing notebook in the local Google session. Fail closed if the UI cannot confirm the new title. */
export async function renamePersonalNotebook({notebookUrl,title}){
 if(!/^https:\/\/notebooklm\.google\.com\/notebook\/[A-Za-z0-9_-]+\/?$/.test(notebookUrl))throw Error('Invalid NotebookLM notebook URL');
 if(!String(title||'').trim()||title.length>160)throw Error('Notebook title must contain 1–160 characters');
 const context=await launch();
 try{
  const page=context.pages()[0]||await context.newPage();
  await page.goto(notebookUrl,{waitUntil:'domcontentloaded',timeout:30000});
  if(!page.url().startsWith(notebookUrl.replace(/\/$/,'')))throw Error('Notebook not accessible in local Google session');
  const rename=await firstVisible(page,['button[aria-label*="rename" i]','button[aria-label*="renommer" i]','[role="button"][aria-label*="rename" i]','[role="button"][aria-label*="renommer" i]']);
  if(rename)await rename.click();
  const edit=await firstVisible(page,['input[aria-label*="title" i]','input[aria-label*="titre" i]','[contenteditable="true"][aria-label*="title" i]','[contenteditable="true"][aria-label*="titre" i]']);
  if(!edit)throw Error('Editable NotebookLM title not found; notebook unchanged');
  await edit.fill(title.trim());
  await edit.press('Enter');
  const confirmed=await page.getByText(title.trim(),{exact:true}).first().isVisible().catch(()=>false);
  if(!confirmed)throw Error('Notebook rename not confirmed by browser UI');
  return {notebookUrl,title:title.trim(),renamed:true};
 }finally{await context.close()}
}

/** Attach a public URL to a notebook through the signed-in local browser.
 * Fails closed: sourceAdded is true only if a matching source is visible after submission.
 * This is UI automation, not an official NotebookLM API.
 */
export async function addPersonalNotebookUrlSource({notebookUrl,sourceUrl}){
 if(!/^https:\/\/notebooklm\.google\.com\/notebook\/[A-Za-z0-9_-]+\/?$/.test(notebookUrl))throw Error('Invalid NotebookLM notebook URL');
 const u=new URL(sourceUrl);
 if(!['https:','http:'].includes(u.protocol)||!u.hostname||u.username||u.password)throw Error('Expected public HTTP(S) source URL');
 const context=await launch();
 try{
  const page=context.pages()[0]||await context.newPage();
  await page.goto(notebookUrl,{waitUntil:'domcontentloaded',timeout:30000});
  if(!page.url().startsWith(notebookUrl.replace(/\/$/,'')))throw Error('Notebook inaccessible in signed-in Google session');
  const add=await firstVisible(page,['button:has-text("Add sources")','button:has-text("Add source")','button:has-text("Ajouter des sources")','button:has-text("Ajouter une source")','[role="button"]:has-text("Add sources")']);
  if(!add)throw Error('Add sources button unavailable');
  await add.click();
  const website=await firstVisible(page,['button:has-text("Website")','button:has-text("Websites")','button:has-text("Site Web")','[role="button"]:has-text("Website")','button:has-text("Link")']);
  if(website)await website.click();
  const field=await firstVisible(page,['textarea','input[type="url"]','input[placeholder*="URL" i]','[role="dialog"] input[type="text"]']);
  if(!field)throw Error('NotebookLM source URL input not found');
  await field.fill(sourceUrl);
  const submit=await firstVisible(page,['[role="dialog"] button:has-text("Insert")','[role="dialog"] button:has-text("Add")','[role="dialog"] button:has-text("Ajouter")','button:has-text("Insérer")']);
  if(!submit)throw Error('NotebookLM add source confirmation unavailable');
  await submit.click();
  const match=page.getByText(u.hostname,{exact:false}).first();
  const confirmed=await match.waitFor({state:'visible',timeout:20000}).then(()=>true).catch(()=>false);
  return {notebookUrl,sourceUrl,sourceAdded:confirmed,verifiedInNotebook:confirmed,note:confirmed?'Source hostname visible in notebook':'Submission attempted but source not confirmed; inspect NotebookLM'};
 }finally{await context.close()}
}
