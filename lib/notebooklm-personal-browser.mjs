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
  if(!url.includes('/notebook/'))throw Error('Could not confirm notebook creation. UI may have changed.');
  const edit=await firstVisible(page,['input[aria-label*="title" i]','input[aria-label*="titre" i]','[contenteditable="true"][aria-label*="title" i]','[contenteditable="true"][aria-label*="titre" i]']);
  let renamed=false;
  if(edit){await edit.fill(title);await edit.press('Enter');renamed=true}
  // Source attachment deliberately not claimed without a verified UI path.
  return {notebookUrl:url,notebookCreated:true,titleSet:renamed,sourceAttached:false,googleDocUrl:googleDocUrl||null,note:'Attach the Google Doc source in NotebookLM; source automation requires validated UI selectors.'};
 }finally{await context.close()}
}
