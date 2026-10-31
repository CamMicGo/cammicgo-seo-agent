#!/usr/bin/env node
// Emits lib/science.mjs (plain JavaScript) from lib/science.ts for the local stdio MCP, which runs on
// any Node version without TypeScript. Run `npm run build:science`; `--check` fails if the file is stale.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const out=mkdtempSync(join(tmpdir(),'cmg-sci-'));
try{
 execFileSync(process.execPath,[join(root,'node_modules','typescript','bin','tsc'),join(root,'lib','science.ts'),'--target','es2022','--module','esnext','--outDir',out,'--removeComments','false','--skipLibCheck'],{stdio:'inherit'});
 const js='// GENERATED from lib/science.ts by scripts/build-science-local.mjs: do not edit.\n'+readFileSync(join(out,'science.js'),'utf8');
 const target=join(root,'lib','science.mjs');
 if(process.argv.includes('--check')){
  if(!existsSync(target)||readFileSync(target,'utf8')!==js){console.error('lib/science.mjs is stale: run npm run build:science');process.exit(1);}
  console.log('lib/science.mjs is up to date');
 }else{writeFileSync(target,js);console.log('wrote lib/science.mjs');}
}finally{rmSync(out,{recursive:true,force:true})}
