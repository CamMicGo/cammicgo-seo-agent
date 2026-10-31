// Live check of the LOCAL stdio MCP science tools (compiled lib/science.mjs) against the real APIs. Runs in CI.
import {spawn} from 'node:child_process';
import {mkdtempSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const file=process.env.LIVE_OUT??'science-live.txt';
const log=l=>{appendFileSync(file,l+'\n');console.log(l);};
const home=mkdtempSync(join(tmpdir(),'cmg-local-'));
const child=spawn(process.execPath,[join(root,'scripts','local-mcp.mjs'),'stdio'],{cwd:root,env:{...process.env,HOME:home,USERPROFILE:home},stdio:['pipe','pipe','pipe']});
let buf='',seq=0;const pending=new Map();
child.stdout.setEncoding('utf8');child.stdout.on('data',c=>{buf+=c;let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);try{const p=JSON.parse(line);pending.get(p.id)?.(p);pending.delete(p.id);}catch{}}});
const rpc=(method,params)=>new Promise((res,rej)=>{const id=++seq;const t=setTimeout(()=>rej(new Error(method+' timeout')),60000);pending.set(id,p=>{clearTimeout(t);res(p);});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
const call=async(name,args)=>JSON.parse((await rpc('tools/call',{name,arguments:args})).result.content[0].text);
try{
 await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'live',version:'1'}});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
 const r=await call('science_latest',{topic:'generative engine optimization',days:365,limit:3});
 log('LOCAL science_latest: '+r.count+' papers · first: '+(r.papers[0]?.title??'-')+' ('+(r.papers[0]?.date??'')+') · sources '+r.sources.map(s=>s.source+':'+(s.error?'ERR':s.found)).join(' ')+(r.keyTip?' · keyTip present':''));
 const p=await call('science_paper',{id:'1706.03762'});
 log('LOCAL science_paper: '+(p.paper?.title??JSON.stringify(p).slice(0,120))+' · citations '+(p.paper?.citations??'-'));
 const s=await call('science_sources',{});
 log('LOCAL science_sources: '+s.sources.map(x=>x.source+' → '+x.limit).join(' | '));
}catch(e){log('LOCAL CRASH '+(e instanceof Error?e.message:String(e)));process.exitCode=1;}
finally{child.kill();}
