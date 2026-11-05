#!/usr/bin/env node
// Local-only campaign review and task activity. No Gmail sending or cloud storage.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync,existsSync,chmodSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
const dir=join(homedir(),'.cammicgo-seo-agent');
const file=join(dir,'campaigns-local.json');
mkdirSync(dir,{recursive:true,mode:0o700});
const token=randomBytes(32).toString('hex');
const port=Number(process.env.CAMMICGO_LOCAL_UI_PORT||38741);
const load=()=>{try{return JSON.parse(readFileSync(file,'utf8'))}catch{return {campaigns:[],activity:[]}}};
function save(db){writeFileSync(file,JSON.stringify(db,null,2),{mode:0o600});try{chmodSync(file,0o600)}catch{}}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const layout=(body)=>`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>CamMicGo · Local</title><style>body{margin:0;background:#0d1223;color:#edf2ff;font:15px system-ui,Arial}header{padding:20px 5%;background:#171e37;display:flex;align-items:center;gap:16px}header img{border-radius:14px;width:54px;height:54px}main{max-width:1050px;margin:auto;padding:30px 20px}nav a{color:#b9c9ff;margin-right:22px}section{background:#1a233d;border:1px solid #34415f;border-radius:16px;padding:22px;margin:20px 0}h1{font-size:28px}h2{font-size:19px}small,.muted{color:#9eacc9}.item{border-top:1px solid #394560;padding:16px 0}button{background:#5b76ee;color:white;border:0;border-radius:9px;padding:11px 17px;cursor:pointer}button.danger{background:#743e57}input,textarea{background:#0e172c;border:1px solid #4d5a7d;color:white;border-radius:8px;padding:10px;width:100%;box-sizing:border-box}label{display:block;margin:12px 0}textarea{min-height:100px}a{color:#a9bdff}code{word-break:break-word}.pill{background:#30405f;padding:5px 9px;border-radius:12px}</style><header><img src="/logo" alt="CamMicGo"><div><b>CamMicGo · Tableau de bord local</b><div class="muted">Données sur cet ordinateur uniquement · Aucun envoi Gmail automatique</div></div></header><main><nav><a href="/">Vue d'ensemble</a><a href="/campaigns">Campagnes</a><a href="/activity">Activité de l'agent</a></nav>${body}</main></html>`;
function render(path,db){if(path==='/campaigns'){return layout(`<h1>Campagnes</h1><section><h2>Créer un brouillon de test</h2><form method="post" action="/create"><label>Nom de campagne<input name="name" maxlength="120" required></label><label>Expéditeur (information, pas d'envoi)<input name="sender" type="email" required></label><label>Destinataires (une adresse par ligne)<textarea name="recipients" required></textarea></label><label>Objet<input name="subject" maxlength="200" required></label><label>Contenu<textarea name="body" required></textarea></label><button>Enregistrer le brouillon</button></form></section>${db.campaigns.map(c=>`<section><h2>${escape(c.name)} <small class="pill">${escape(c.status)}</small></h2><p>De : ${escape(c.sender)} · ${c.recipients.length} destinataire(s)</p><p>Objet : ${escape(c.subject)}</p><details><summary>Voir le contenu et les destinataires</summary><pre style="white-space:pre-wrap">${escape(c.recipients.join('\n'))}</pre><p>${escape(c.body)}</p></details>${c.status==='draft'?`<form method="post" action="/review"><input type="hidden" name="id" value="${escape(c.id)}"><button>Marquer comme relu (sans envoi)</button></form>`:''}</section>`).join('')}`)}
if(path==='/activity')return layout(`<h1>Activité locale</h1><section><p class="muted">Historique des événements enregistrés par le tableau de bord. Les appels MCP existants ne sont pas encore instrumentés.</p>${db.activity.slice().reverse().map(e=>`<div class="item"><small>${escape(e.time)}</small><p>${escape(e.message)}</p></div>`).join('')||'Aucune activité.'}</section>`);
return layout(`<h1>Vue d'ensemble</h1><section><h2>État du module local</h2><p>Campagnes enregistrées : <strong>${db.campaigns.length}</strong></p><p>Campagnes relues : <strong>${db.campaigns.filter(c=>c.status==='reviewed').length}</strong></p><p>Envoi Gmail : <strong>désactivé</strong></p><p>Interface limitée à 127.0.0.1, protégée par un secret de session.</p></section><section><h2>Activité récente</h2>${db.activity.slice(-5).reverse().map(e=>`<div class="item">${escape(e.message)} <small>${escape(e.time)}</small></div>`).join('')||'<p>Aucune tâche pour le moment.</p>'}</section>`)}
const server=createServer(async(req,res)=>{try{
const u=new URL(req.url,'http://127.0.0.1:'+port);
const origin=req.headers.origin;
if(origin&&origin!=='http://127.0.0.1:'+port){res.writeHead(403).end('Forbidden origin');return}
const host=req.headers.host;if(host!=='127.0.0.1:'+port){res.writeHead(403).end('Forbidden host');return}
const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim());
const valid=cookie.includes('cammicgo_local='+token);
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
if(u.pathname==='/auth'&&u.searchParams.get('key')===token){res.writeHead(303,{...headers,'Set-Cookie':'cammicgo_local='+token+'; HttpOnly; SameSite=Strict; Path=/','Location':'/'}).end();return}
if(!valid){res.writeHead(403,headers).end('Access denied. Open the private URL printed in your terminal.');return}
if(u.pathname==='/logo'){res.writeHead(200,{...headers,'Content-Type':'image/svg+xml'}).end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#536df5"/><circle cx="32" cy="28" r="17" fill="#a5d7ff"/><circle cx="32" cy="28" r="9" fill="#263c8e"/><path d="m20 48 9 7 17-17" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>');return}
const db=load();
if(req.method==='POST'&&['/create','/review'].includes(u.pathname)){
let data='';for await(const chunk of req){data+=chunk;if(data.length>100000){res.writeHead(413).end();return}}
const form=new URLSearchParams(data);
if(u.pathname==='/create'){const recipients=(form.get('recipients')||'').split(/[\n,;]/).map(x=>x.trim()).filter(Boolean);if(!recipients.length||recipients.length>500||recipients.some(x=>!/^\S+@\S+\.\S+$/.test(x))){res.writeHead(400).end('Invalid recipients');return}
const c={id:randomBytes(16).toString('hex'),name:(form.get('name')||'').slice(0,120),sender:(form.get('sender')||'').slice(0,200),recipients,subject:(form.get('subject')||'').slice(0,200),body:(form.get('body')||'').slice(0,20000),status:'draft'};db.campaigns.push(c);db.activity.push({time:new Date().toISOString(),message:'Brouillon créé : '+c.name});}
else{const c=db.campaigns.find(x=>x.id===form.get('id'));if(!c){res.writeHead(404).end();return}c.status='reviewed';db.activity.push({time:new Date().toISOString(),message:'Brouillon relu (aucun e-mail envoyé) : '+c.name})}
save(db);res.writeHead(303,{...headers,Location:'/campaigns'}).end();return}
if(req.method!=='GET'||!['/','/campaigns','/activity'].includes(u.pathname)){res.writeHead(404).end();return}
res.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'}).end(render(u.pathname,db))
}catch(e){console.error(e);res.writeHead(500).end('Local error')}});
server.listen(port,'127.0.0.1',()=>{const url='http://127.0.0.1:'+port+'/auth?key='+token;console.log('CamMicGo local dashboard:',url);console.log('Keep this URL private. Ctrl+C to stop.');if(process.argv.includes('--open')){const cmd=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];const p=spawn(cmd,args,{detached:true,stdio:'ignore'});p.on('error',()=>{});p.unref()}});