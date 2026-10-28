#!/usr/bin/env node
// Safe protocol smoke test: ephemeral fake OAuth token; no real Google API calls or user data.
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes,createCipheriv} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/server/client';
import {StdioClientTransport} from '@modelcontextprotocol/server/client/stdio';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const temp=mkdtempSync(join(tmpdir(),'cmg-mcp-smoke-'));
try{
 const dir=join(temp,'.cammicgo-seo-agent');mkdirSync(dir,{mode:0o700});
 const key=randomBytes(32),iv=randomBytes(12);
 writeFileSync(join(dir,'token.key'),key,{mode:0o600});
 const cipher=createCipheriv('aes-256-gcm',key,iv);
 const payload=Buffer.concat([cipher.update(JSON.stringify({accessToken:'fake-for-protocol-test',expiresAt:Date.now()+3600000,refreshToken:'fake'})),cipher.final()]);
 writeFileSync(join(dir,'google-token.enc'),Buffer.concat([iv,cipher.getAuthTag(),payload]),{mode:0o600});
 const client=new Client({name:'cammicgo-local-smoke-test',version:'0.1.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:[join(root,'scripts','local-mcp.mjs'),'stdio'],cwd:root,env:{...process.env,HOME:temp,USERPROFILE:temp,GOOGLE_CLIENT_ID:'test.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'test-only-not-real'}});
 await client.connect(transport);
 const tools=await client.listTools();
 const names=new Set(tools.tools.map(t=>t.name));
 for(const required of ['service_info','list_search_sites','search_performance','seo_keyword_opportunities','list_ga4_properties','ga4_top_pages','ga4_countries','youtube_my_channels','youtube_my_videos','youtube_video_metrics','calendar_list','calendar_upcoming_events','find_google_properties']){
   if(!names.has(required))throw new Error('MCP tool missing: '+required);
 }
 const result=await client.callTool({name:'service_info',arguments:{}});
 if(!result.content?.[0]?.text?.includes('cammicgo-seo'))throw new Error('service_info returned invalid payload');
 console.log('PASS: stdio MCP handshake, tool discovery ('+names.size+'), service_info invocation.');
 await client.close();
}catch(e){console.error('FAIL: '+(e instanceof Error?e.message:String(e)));process.exitCode=1}
finally{rmSync(temp,{recursive:true,force:true})}
