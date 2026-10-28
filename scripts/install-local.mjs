#!/usr/bin/env node
// Guided single-command setup for the source-based local MCP.
import {existsSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function ask(message){const rl=createInterface({input:stdin,output:stdout});try{return await rl.question(message)}finally{rl.close()}}
function run(file,args=[]){return new Promise((resolveRun,reject)=>{const child=spawn(process.execPath,[join(root,'scripts',file),...args],{cwd:root,stdio:'inherit'});child.on('error',reject);child.on('exit',c=>c===0?resolveRun():reject(new Error(file+' failed with exit code '+c)))})}
try{
 console.log('\nCamMicGo SEO Agent — Installation locale guidée\n');
 console.log('Configuration requise (une seule fois) dans votre propre Google Cloud :');
 console.log('  https://console.cloud.google.com/apis/dashboard');
 console.log('  Activez Search Console API, Analytics Data API et Analytics Admin API.');
 console.log('  OAuth Web client — ajoutez ces deux URI autorisées :');
 console.log('  http://localhost:3000/api/auth/google/callback');
 console.log('  http://127.0.0.1:38271/oauth/callback');
 console.log('  Ajoutez votre compte Google comme testeur si le consentement est en mode Testing.\n');
 const ack=(await rl.question('Ces étapes Google Cloud sont-elles terminées ? (o/N) : ')).trim().toLowerCase();
 if(!['o','oui','y','yes'].includes(ack)){console.log('Vous pourrez relancer npm run install:local une fois Google Cloud configuré.');process.exitCode=0}
 else{
  if(existsSync(join(root,'.env.local')))console.log('Identifiants locaux existants conservés ; utiliser setup:local pour les remplacer volontairement.');
  else await run('setup-local.mjs');
  await run('local-mcp.mjs',['login']);
  await run('local-mcp.mjs',['doctor']);
  const target=(await rl.question('Quel agent souhaitez-vous configurer ? (claude/gemini/cursor/aucun) : ')).trim().toLowerCase();
  if(['claude','gemini','cursor'].includes(target))await run('setup-agent.mjs',[target]);
  else console.log('Configuration automatique ignorée ; le MCP local peut être lancé via npm run mcp:local.');
  console.log('\nTerminé. Redémarrez votre agent IA puis demandez : « Liste mes propriétés Google Search Console ».');
  console.log('Aucun token Google n’a été transmis à CamMicGo Vercel ou Supabase par cette installation.');
 }
}catch(e){console.error('Échec de la configuration locale :',e instanceof Error?e.message:e);process.exitCode=1}
