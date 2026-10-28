#!/usr/bin/env node
/**
 * Register local CamMicGo MCP in known user-level clients without writing any OAuth secrets.
 * Creates backups, preserves existing settings and declines overwriting an existing CamMicGo entry.
 */
import {existsSync,readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {homedir,platform} from 'node:os';
import {fileURLToPath} from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const script=join(repo,'scripts','local-mcp.mjs');
const home=homedir(),os=platform();
const configs={
 gemini:join(home,'.gemini','settings.json'),
 cursor:join(home,'.cursor','mcp.json'),
 claude:os==='win32'?join(process.env.APPDATA||join(home,'AppData','Roaming'),'Claude','claude_desktop_config.json'):os==='darwin'?join(home,'Library','Application Support','Claude','claude_desktop_config.json'):join(home,'.config','Claude','claude_desktop_config.json')
};
const target=process.argv[2]||'';
if(!['gemini','cursor','claude'].includes(target)){console.error('Usage: npm run agent:setup -- gemini|cursor|claude');process.exit(2)}
const file=configs[target],id='cammicgo-seo-local';
let data={};if(existsSync(file)){try{data=JSON.parse(readFileSync(file,'utf8'))}catch{console.error('Existing configuration is not valid JSON, refusing to modify:',file);process.exit(1)}}
if(!data||typeof data!=='object'||Array.isArray(data)){console.error('Invalid config object');process.exit(1)}
const servers=data.mcpServers&&typeof data.mcpServers==='object'&&!Array.isArray(data.mcpServers)?data.mcpServers:{};
if(servers[id]){console.log('Existing CamMicGo entry found; no changes made to',file);process.exit(0)}
// Gemini CLI expects mcpServers.<name>.command/args, just like desktop clients.
const config={...data,mcpServers:{...servers,[id]:{command:process.execPath,args:[script,'stdio']}}};
mkdirSync(dirname(file),{recursive:true,mode:0o700});
if(existsSync(file)){const backup=file+'.cammicgo-backup';if(existsSync(backup)){console.error('Backup already exists, refusing to overwrite:',backup);process.exit(1)}copyFileSync(file,backup);console.log('Backup:',backup)}
writeFileSync(file,JSON.stringify(config,null,2)+'\n',{mode:0o600});
console.log('CamMicGo local MCP configured for',target,'at',file);
console.log('Restart your agent. First run npm run local:login to authorize your Google account.');
console.log('No OAuth secrets or refresh tokens were written to the agent configuration.');
