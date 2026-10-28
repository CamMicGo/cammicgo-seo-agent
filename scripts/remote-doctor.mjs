#!/usr/bin/env node
// Remote MCP health check. Never sends any Google credential.
const base=(process.argv[2]||'https://seo.cammicgo.com').replace(/\/$/,'');
if(!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)){console.error('Provide an HTTPS origin');process.exit(2)}
try{
 const h=await fetch(base+'/api/mcp/status',{cache:'no-store'}),body=await h.json().catch(()=>null);
 console.log('Remote service status:',h.status,JSON.stringify(body,null,2));
 if(!h.ok)process.exitCode=1;
 if(body?.oauthMcpReady!==true)console.log('Remote agent OAuth is NOT ready. Do not connect private Google data to external agents.');
 const m=await fetch(base+'/api/mcp',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream','MCP-Protocol-Version':'2025-06-18'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'cammicgo-remote-doctor',version:'0.1.0'}}})});
 console.log('MCP transport HTTP status:',m.status);
 if(m.status!==200&&m.status!==202){console.log('MCP transport is not accepting anonymous discovery yet.');process.exitCode=1}
}catch(e){console.error('Remote MCP diagnostic failed:',e instanceof Error?e.message:e);process.exitCode=1}
