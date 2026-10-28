#!/usr/bin/env node
// Local BYO Google OAuth setup. Never transmit credentials outside this machine.
import {createInterface} from 'node:readline/promises';
import {stdin as input,stdout as output} from 'node:process';
import {randomBytes} from 'node:crypto';
import {existsSync,writeFileSync,readFileSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
const rl=createInterface({input,output});
const path=resolve(process.cwd(),'.env.local');
const validId=(s)=>/^[\w.-]+\.apps\.googleusercontent\.com$/.test(s)&&s.length<251;
const encode=(s)=>JSON.stringify(s);
try{
 console.log('\nCamMicGo SEO Agent — configuration locale Google (BYO)\n');
 console.log('1. Google Cloud → activez Search Console API, Analytics Data API et Analytics Admin API.');
 console.log('2. Google Auth Platform → Audience → ajoutez votre compte comme testeur si nécessaire.');
 console.log('3. Clients → créez une application Web OAuth avec cette URL EXACTE :');
 console.log('   http://localhost:3000/api/auth/google/callback\n');
 if(existsSync(path)){
  const reply=(await rl.question('.env.local existe déjà. Le remplacer ? (tapez OUI) : ')).trim();
  if(reply!=='OUI'){console.log('Aucun fichier modifié.');process.exit(0);}
  const old=readFileSync(path,'utf8');
  if(old.trim()){const backup=resolve(process.cwd(),'.env.local.backup');if(existsSync(backup)){console.log('Sauvegarde existante détectée. Abandon pour éviter un écrasement.');process.exit(0);}writeFileSync(backup,old,{mode:0o600});console.log('Ancien fichier sauvegardé dans .env.local.backup (privé).');}
 }
 const id=(await rl.question('Google OAuth Client ID : ')).trim();
 if(!validId(id))throw new Error('Client ID Google invalide. Aucun fichier nouveau écrit.');
 const secret=(await rl.question('Google OAuth Client Secret (entrée visible dans ce terminal) : ')).trim();
 if(!secret||secret.length>700||/[\r\n]/.test(secret))throw new Error('Secret Google invalide.');
 const env=[
  '# Generated locally; keep private. OAuth web dashboard only, not local stdio MCP.',
  'APP_BASE_URL=http://localhost:3000',
  'GOOGLE_CLIENT_ID='+encode(id),
  'GOOGLE_CLIENT_SECRET='+encode(secret),
  'SESSION_ENCRYPTION_KEY='+encode(randomBytes(32).toString('base64')),
  'ENABLE_MCP_BETA=false',
  ''
 ].join('\n');
 writeFileSync(path,env,{mode:0o600});try{chmodSync(path,0o600)}catch{}
 console.log('\nConfiguration enregistrée localement dans .env.local (clé de chiffrement générée).');
 console.log('Ne partagez jamais ce fichier. Lancez : npm run dev');
 console.log('Puis ouvrez : http://localhost:3000/connect');
 console.log('Attention : cela active le tableau de bord local, PAS encore un exécutable MCP stdio.');
} catch(e){console.error('Erreur :',e instanceof Error?e.message:'Erreur inconnue');process.exitCode=1;}
finally{rl.close()}
