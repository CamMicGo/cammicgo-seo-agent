#!/usr/bin/env node
// Import a Google OAuth Desktop client JSON locally; never print or upload secrets.
import {readFileSync,writeFileSync,existsSync,chmodSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
const rl=createInterface({input:stdin,output:stdout});
try{
 const name=process.argv[2]||await rl.question('Chemin du fichier OAuth Bureau Google (.json) : ');
 if(!name.trim())throw Error('Chemin du fichier manquant');
 const json=JSON.parse(readFileSync(resolve(name.trim().replace(/^["']|["']$/g,'')),'utf8'));
 if(!json.installed||json.web)throw Error('Le JSON doit contenir une application OAuth de type Bureau (installed).');
 const {client_id:id,client_secret:secret}=json.installed;
 if(typeof id!=='string'||!id.endsWith('.apps.googleusercontent.com')||typeof secret!=='string'||!secret)throw Error('Client OAuth Bureau invalide');
 const file=resolve('.env.local');
 if(existsSync(file)){
  const answer=(await rl.question('Le fichier .env.local existe. Remplacer la configuration existante ? (taper OUI) : ')).trim();
  if(answer!=='OUI'){console.log('Aucune modification.');process.exit(0)}
  throw Error('Pour éviter de perdre une configuration existante, déplacez .env.local dans un endroit sûr et relancez la commande.');
 }
 const value=[
  '# Generated from your own Google OAuth Desktop client. Do not commit.',
  'APP_BASE_URL=http://localhost:3000',
  'GOOGLE_CLIENT_ID='+JSON.stringify(id),
  'GOOGLE_CLIENT_SECRET='+JSON.stringify(secret),
  'SESSION_ENCRYPTION_KEY='+JSON.stringify(randomBytes(32).toString('base64')),
  'ENABLE_MCP_BETA=false',''
 ].join('\n');
 writeFileSync(file,value,{mode:0o600,flag:'wx'});try{chmodSync(file,0o600)}catch{}
 console.log('Identifiants Bureau configurés dans .env.local. Aucune clé affichée ou transmise.');
 console.log('Continuer avec : npm run local:login, puis npm run agent:setup -- claude');
} catch(e){console.error('Erreur de configuration :',e instanceof Error?e.message:e);process.exitCode=1}
finally{rl.close()}
