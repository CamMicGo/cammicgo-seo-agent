/** Local control page of the desktop relay (served on 127.0.0.1 only). */
export function page(key, version) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CamMicGo SEO MCP — Relais ordinateur</title>
<link rel="icon" href="https://seo.cammicgo.com/branding/cammicgo-plugin-icon-256.png">
<style>
:root{--ink:#172040;--muted:#5f6e8c;--line:#dfe7f5;--bg:#f4f7fd;--card:#fff;--blue:#2764df;--violet:#6a4cf0;--green:#16a34a;--red:#dc2626;--amber:#d97706;--soft:#eef3ff}
@media (prefers-color-scheme:dark){:root{--ink:#e8edfb;--muted:#9aa8c5;--line:#26324f;--bg:#0c1222;--card:#131b30;--soft:#1a2542}}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink)}
.wrap{max-width:860px;margin:0 auto;padding:22px 16px 60px}
header{display:flex;align-items:center;gap:14px;margin-bottom:18px}header img{width:52px;height:52px;border-radius:14px}
header h1{font-size:20px;margin:0;letter-spacing:-.3px}header small{color:var(--muted)}.pill{margin-left:auto;display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:7px 13px;font-weight:700;font-size:13px;white-space:nowrap}
.dot{width:10px;height:10px;border-radius:50%;background:#94a3b8}.dot.on{background:var(--green);box-shadow:0 0 0 4px #16a34a22}.dot.pause{background:var(--amber)}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:22px;margin-bottom:16px;box-shadow:0 10px 30px -22px #1b2b6b55}
.card h2{margin:0 0 6px;font-size:19px}.card p{margin:0 0 12px;color:var(--muted)}.kicker{font-size:12px;font-weight:800;letter-spacing:1.6px;color:var(--blue);text-transform:uppercase}
.hero{background:linear-gradient(135deg,#2764df,#6a4cf0);color:#fff;border:0}.hero p{color:#e6ebff}.hero .kicker{color:#cfe0ff}
.steps{display:grid;gap:12px;margin-top:14px}.step{display:flex;gap:12px;align-items:flex-start;background:var(--soft);border-radius:14px;padding:14px}
.num{flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--blue);color:#fff;font-weight:800}
.step b{display:block}.step span{color:var(--muted);font-size:14px}.step .num{color:#fff;font-size:15px}
.quote{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}.quote code{background:var(--card);border:1px dashed var(--line);border-radius:10px;padding:8px 10px;font-size:13px;color:var(--ink)}
input,select,textarea{font:inherit;color:var(--ink);background:var(--card);border:1.5px solid var(--line);border-radius:12px;padding:12px 14px;width:100%;outline:none}
input:focus,select:focus,textarea:focus{border-color:var(--blue)}#code{font:700 24px/1 ui-monospace,Consolas,monospace;letter-spacing:4px;text-align:center;text-transform:uppercase}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.row>*{flex:1 1 200px}
button{font:inherit;font-weight:700;border:0;border-radius:12px;padding:12px 18px;cursor:pointer;background:var(--blue);color:#fff;white-space:nowrap}
button.sec{background:var(--soft);color:var(--blue);border:1px solid var(--line)}button.danger{background:transparent;color:var(--red);border:1px solid #f3c6c6}
button:disabled{opacity:.55;cursor:wait}.small{padding:8px 12px;font-size:13px;flex:none}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.stat{background:var(--soft);border-radius:14px;padding:12px}.stat b{font-size:20px;display:block}.stat span{font-size:12px;color:var(--muted)}
.msg{margin-top:10px;font-size:14px;font-weight:600}.msg.err{color:var(--red)}.msg.ok{color:var(--green)}
.log{list-style:none;margin:10px 0 0;padding:0;font-size:13px;color:var(--muted);max-height:180px;overflow:auto}.log li{padding:5px 0;border-top:1px solid var(--line)}.log time{font-variant-numeric:tabular-nums;margin-right:8px}
.prompts{display:grid;gap:8px}.prompt{display:flex;gap:10px;align-items:center;justify-content:space-between;background:var(--soft);border-radius:12px;padding:10px 12px;font-size:14px}
textarea{min-height:220px;font:13px/1.5 ui-monospace,Consolas,monospace;resize:vertical}
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.tiles button{padding:10px}
.hint{font-size:13px;color:var(--muted);margin-top:6px}.hide{display:none!important}
.note{font-size:13px;color:var(--muted);text-align:center;margin-top:20px}
@media(max-width:560px){.stats{grid-template-columns:1fr 1fr}.tiles{grid-template-columns:1fr 1fr}.pill{display:none}}
</style></head><body><div class="wrap">
<header><img src="https://seo.cammicgo.com/branding/cammicgo-seo-mcp-apk-icon.png" alt=""><div><h1>CamMicGo SEO MCP</h1><small>Relais ordinateur · v${version}</small></div><span class="pill"><span class="dot" id="pdot"></span><span id="ptext">…</span></span></header>

<section class="card hero"><span class="kicker">Pourquoi cette application ?</span><h2>Votre ordinateur récupère les transcriptions YouTube pour votre assistant</h2>
<p>YouTube bloque les serveurs cloud. Avec le serveur MCP distant (Claude, ChatGPT…), c’est donc votre ordinateur qui télécharge les sous-titres avec votre propre connexion, puis les renvoie à votre assistant. Laissez simplement cette fenêtre ouverte.</p></section>

<section class="card" id="pairCard"><span class="kicker">Première utilisation</span><h2>Associer cet ordinateur à votre compte</h2>
<div class="steps">
 <div class="step"><span class="num">1</span><div><b>Demandez un code à votre assistant IA</b><span>Dans Claude, ChatGPT… (connecté à CamMicGo SEO MCP), écrivez :</span>
  <div class="quote"><code id="askPair">Génère un code d’appairage CamMicGo pour mon ordinateur.</code><button class="sec small" data-copy="askPair">Copier</button></div></div></div>
 <div class="step"><span class="num">2</span><div style="flex:1"><b>Saisissez le code reçu (8 caractères, valable 10 minutes)</b>
  <div class="row" style="margin-top:8px"><input id="code" maxlength="9" placeholder="ABCD-2345" autocomplete="off" spellcheck="false"><button id="pairBtn">Associer</button></div>
  <input id="name" style="margin-top:8px" placeholder="Nom de l’ordinateur"><div class="msg" id="pairMsg"></div></div></div>
 <div class="step"><span class="num">3</span><div><b>C’est tout</b><span>Le mode connecté démarre tout seul. Demandez ensuite une transcription à votre assistant.</span></div></div>
</div></section>

<section class="card hide" id="statusCard"><span class="kicker">Mode connecté</span><h2 id="devName">Ordinateur</h2><p id="statusText"></p>
<div class="stats"><div class="stat"><b id="sJobs">0</b><span>transcriptions envoyées</span></div><div class="stat"><b id="sSync">—</b><span>dernier contact serveur</span></div><div class="stat"><b id="sState">—</b><span>état</span></div></div>
<div class="row"><button id="toggleBtn">Démarrer</button><button class="danger" id="unpairBtn" style="flex:0 0 auto">Dissocier</button></div>
<ul class="log" id="log"></ul></section>

<section class="card hide" id="askCard"><span class="kicker">Ensuite</span><h2>Que demander à votre assistant ?</h2><div class="prompts" id="prompts"></div></section>

<section class="card"><span class="kicker">Tester sans assistant</span><h2>Extraire la transcription d’une vidéo</h2>
<p>Collez un lien YouTube. La langue originale est choisie par défaut ; les autres langues disponibles s’affichent dans la liste.</p>
<input id="url" placeholder="https://www.youtube.com/watch?v=…">
<div class="row" style="margin-top:10px"><select id="lang"><option value="original">Langue originale</option></select><button id="extractBtn" style="flex:0 0 auto">Extraire</button></div>
<div class="hint" id="langHint"></div><div class="msg" id="exMsg"></div>
<div id="result" class="hide" style="margin-top:12px"><textarea id="out" readonly></textarea>
<div class="tiles"><button class="sec" data-exp="srt">SRT</button><button class="sec" data-exp="vtt">VTT</button><button class="sec" data-exp="txt">TXT horodaté</button><button class="sec" data-exp="json">JSON</button></div>
<div class="row" style="margin-top:8px"><button class="sec" id="copyOut">Copier la transcription</button></div></div></section>

<p class="note">Les données restent entre votre ordinateur, YouTube et votre compte CamMicGo. Page locale accessible uniquement depuis cet ordinateur.</p>
</div>
<script>
const KEY=${JSON.stringify(key)};
const $=id=>document.getElementById(id);
async function call(path,opts={}){const r=await fetch(path,{...opts,headers:{'X-CMG-Key':KEY,'Content-Type':'application/json'}});const j=await r.json().catch(()=>({error:'Réponse invalide'}));if(!r.ok)throw new Error(j.error||('Erreur '+r.status));return j}
const PROMPTS=['Donne-moi la transcription horodatée de cette vidéo : <lien>','Résume cette vidéo YouTube avec les moments clés horodatés : <lien>','Récupère les transcriptions des 20 dernières vidéos de <chaîne> dans un seul document pour NotebookLM.','Dans les 10 dernières vidéos de <chaîne>, retrouve les passages où il parle de <sujet>.'];
$('prompts').innerHTML=PROMPTS.map((p,i)=>'<div class="prompt"><span id="pr'+i+'"></span><button class="sec small" data-copy="pr'+i+'">Copier</button></div>').join('');
PROMPTS.forEach((p,i)=>$('pr'+i).textContent=p);
document.addEventListener('click',e=>{const b=e.target.closest('[data-copy]');if(!b)return;navigator.clipboard.writeText($(b.dataset.copy).textContent).then(()=>{const t=b.textContent;b.textContent='Copié ✓';setTimeout(()=>b.textContent=t,1400)})});
const ago=t=>{if(!t)return '—';const s=Math.round((Date.now()-t)/1000);return s<60?s+' s':Math.round(s/60)+' min'};
let S=null;
function render(s){S=s;
 $('pairCard').classList.toggle('hide',s.paired);$('statusCard').classList.toggle('hide',!s.paired);$('askCard').classList.toggle('hide',!s.paired);
 if(!$('name').value)$('name').placeholder='Nom de l’ordinateur (par défaut : '+s.suggestedName+')';
 const paused=s.pausedUntil>Date.now();
 $('pdot').className='dot'+(s.running?(paused?' pause':' on'):'');
 $('ptext').textContent=!s.paired?'Non appairé':s.running?(paused?'En pause':'Connecté'):'Arrêté';
 $('devName').textContent=s.deviceName||'Ordinateur';$('statusText').textContent=s.status;
 $('sJobs').textContent=s.jobsDone;$('sSync').textContent=s.running?ago(s.lastSync):'—';$('sState').textContent=$('ptext').textContent;
 $('toggleBtn').textContent=s.running?'Arrêter le mode connecté':'Démarrer le mode connecté';$('toggleBtn').className=s.running?'sec':'';
 $('log').innerHTML='';for(const l of s.log){const li=document.createElement('li');const t=document.createElement('time');t.textContent=new Date(l.at).toLocaleTimeString();li.append(t,l.text);$('log').append(li)}
}
async function refresh(){try{render(await call('/api/state'))}catch(e){$('ptext').textContent='Relais fermé'}}
refresh();setInterval(refresh,3000);
$('code').addEventListener('input',e=>{let v=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);e.target.value=v.length>4?v.slice(0,4)+'-'+v.slice(4):v});
$('pairBtn').onclick=async()=>{const b=$('pairBtn');b.disabled=true;$('pairMsg').className='msg';$('pairMsg').textContent='Association…';
 try{render(await call('/api/pair',{method:'POST',body:JSON.stringify({code:$('code').value,name:$('name').value.trim()||undefined})}));$('pairMsg').textContent=''}
 catch(e){$('pairMsg').className='msg err';$('pairMsg').textContent=e.message}finally{b.disabled=false}};
$('toggleBtn').onclick=async()=>render(await call(S&&S.running?'/api/stop':'/api/start',{method:'POST'}));
$('unpairBtn').onclick=async()=>{if(confirm('Dissocier cet ordinateur ? Il faudra un nouveau code pour l’associer.'))render(await call('/api/unpair',{method:'POST'}))};
let timer=null,lastV='';
function vid(s){const m=s.match(/(?:[?&]v=|youtu\\.be\\/|\\/shorts\\/|\\/embed\\/|\\/live\\/)([A-Za-z0-9_-]{11})/);return m?m[1]:(/^[A-Za-z0-9_-]{11}$/.test(s.trim())?s.trim():'')}
$('url').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(loadLangs,600)});
async function loadLangs(){const v=vid($('url').value);if(!v||v===lastV)return;lastV=v;$('langHint').textContent='Recherche des langues disponibles…';
 try{const r=await call('/api/tracks?locale='+encodeURIComponent(navigator.language||'fr')+'&v='+v);const sel=$('lang');sel.innerHTML='';
  if(!r.tracks.length){sel.innerHTML='<option value="original">Langue originale</option>';$('langHint').textContent='Aucun sous-titre trouvé pour cette vidéo.';return}
  for(const t of r.tracks){const o=document.createElement('option');o.value=t.code;o.textContent=t.code==='original'?t.label:t.label+(t.original?' · version originale':'')+(t.auto?' · automatique':' · manuelle');sel.append(o)}
  $('langHint').textContent=(r.title?'« '+r.title+' » · ':'')+(r.tracks.length-1)+' langue(s) disponible(s). Toute autre langue peut être traduite par votre assistant.'}
 catch(e){$('langHint').textContent='Langues indisponibles : '+e.message}}
let R=null;
const p2=n=>String(n).padStart(2,'0');
function stamp(t,ms,sep){t=Math.max(0,t);const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=Math.floor(t%60),f=Math.round((t%1)*1000)%1000;return p2(h)+':'+p2(m)+':'+p2(s)+(ms?sep+String(f).padStart(3,'0'):'')}
function short(t){const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=Math.floor(t%60);return '['+(h?h+':'+p2(m):p2(m))+':'+p2(s)+']'}
const end=(s,i,a)=>s.duration>0?s.start+s.duration:(a[i+1]?a[i+1].start:s.start+2);
function fmt(kind){const seg=R.segments;
 if(kind==='json')return JSON.stringify(R,null,2);
 if(kind==='srt')return seg.map((s,i,a)=>(i+1)+'\\n'+stamp(s.start,1,',')+' --> '+stamp(end(s,i,a),1,',')+'\\n'+s.text+'\\n').join('\\n');
 if(kind==='vtt')return 'WEBVTT\\n\\n'+seg.map((s,i,a)=>stamp(s.start,1,'.')+' --> '+stamp(end(s,i,a),1,'.')+'\\n'+s.text+'\\n').join('\\n');
 return seg.map(s=>short(s.start)+' '+s.text).join('\\n')}
$('extractBtn').onclick=async()=>{const v=vid($('url').value);if(!v){$('exMsg').className='msg err';$('exMsg').textContent='Lien YouTube invalide.';return}
 const b=$('extractBtn');b.disabled=true;$('exMsg').className='msg';$('exMsg').textContent='Extraction en cours…';
 try{R=await call('/api/transcript?v='+v+'&lang='+encodeURIComponent($('lang').value));$('out').value=fmt('txt');$('result').classList.remove('hide');
  $('exMsg').className='msg ok';$('exMsg').textContent=R.segments.length+' segments · '+(R.languageName||R.language)+(R.isAutoGenerated?' (automatique)':'')}
 catch(e){$('exMsg').className='msg err';$('exMsg').textContent=e.message}finally{b.disabled=false}};
document.querySelectorAll('[data-exp]').forEach(b=>b.onclick=()=>{if(!R)return;const k=b.dataset.exp;const blob=new Blob([fmt(k)],{type:k==='json'?'application/json':'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=R.videoId+'-'+R.language+'.'+k;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)});
$('copyOut').onclick=()=>navigator.clipboard.writeText($('out').value).then(()=>{$('copyOut').textContent='Copié ✓';setTimeout(()=>$('copyOut').textContent='Copier la transcription',1400)});
</script></body></html>`;
}
