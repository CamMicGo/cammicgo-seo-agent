#!/usr/bin/env node
// Safe protocol smoke test: ephemeral fake OAuth token; no real Google API calls or user data.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes,createCipheriv} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const temp=mkdtempSync(join(tmpdir(),'cmg-mcp-smoke-'));
try{
 const dir=join(temp,'.cammicgo-seo-agent');mkdirSync(dir,{mode:0o700});
 const key=randomBytes(32),iv=randomBytes(12);
 writeFileSync(join(dir,'token.key'),key,{mode:0o600});
 const cipher=createCipheriv('aes-256-gcm',key,iv);
 const payload=Buffer.concat([cipher.update(JSON.stringify({accessToken:'fake-for-protocol-test',expiresAt:Date.now()+3600000,refreshToken:'fake'})),cipher.final()]);
 writeFileSync(join(dir,'google-token.enc'),Buffer.concat([iv,cipher.getAuthTag(),payload]),{mode:0o600});
 const child=spawn(process.execPath,[join(root,'scripts','local-mcp.mjs'),'stdio'],{cwd:root,env:{...process.env,HOME:temp,USERPROFILE:temp,GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-only-not-real'},stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='',seq=0;const pending=new Map();
 child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{stdout+=chunk;let idx;while((idx=stdout.indexOf('\n'))>=0){const line=stdout.slice(0,idx);stdout=stdout.slice(idx+1);try{const packet=JSON.parse(line);const item=pending.get(packet.id);if(item){pending.delete(packet.id);item.resolve(packet)}}catch{}}});
 child.stderr.setEncoding('utf8');child.stderr.on('data',x=>{stderr+=x});
 function rpc(method,params){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('MCP '+method+' timed out: '+stderr.slice(-350)))},12000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n')})}
 try{
  const init=await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'cammicgo-local-smoke-test',version:'0.1.0'}});
  if(init.error||!init.result)throw Error('MCP handshake failed: '+JSON.stringify(init));
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const tools=(await rpc('tools/list',{})).result?.tools||[];
  const names=new Set(tools.map(t=>t.name));
  for(const required of ['service_info','list_search_sites','search_performance','seo_keyword_opportunities','list_ga4_properties','ga4_top_pages','ga4_countries','youtube_my_channels','youtube_my_videos','youtube_video_metrics','calendar_list','calendar_upcoming_events','find_google_properties']){
   if(!names.has(required))throw new Error('MCP tool missing: '+required);
  }
  const result=await rpc('tools/call',{name:'service_info',arguments:{}});
  if(!JSON.stringify(result).includes('CamMicGo SEO Agent Local'))throw new Error('service_info returned invalid payload');
  console.log('PASS: stdio MCP handshake, tool discovery ('+names.size+'), service_info invocation.');
 }finally{child.kill();child.stdin.end()}

}catch(e){console.error('FAIL: '+(e instanceof Error?e.message:String(e)));process.exitCode=1}
finally{rmSync(temp,{recursive:true,force:true})}
