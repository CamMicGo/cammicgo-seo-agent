// Unit tests for lib/google-scopes.ts — run with: npm test
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitScopes,consentSteps,DRIVE_WRITE_SCOPES} from '../lib/google-scopes.ts';

const G='https://www.googleapis.com/auth/';
const YT=G+'youtube.readonly',DR=G+'drive.readonly',DF=G+'drive.file',DFULL=G+'drive',GSC=G+'webmasters.readonly';

test('drive.file never shares a Google grant with YouTube', ()=>{
 const {main,write}=splitScopes([GSC,YT,DR,DF]);
 assert.deepEqual(main,[GSC,YT,DR]);
 assert.deepEqual(write,[DF]);
 assert.ok(!main.includes(DF)&&!main.includes(DFULL));
});
test('full Drive access is also kept apart, duplicates removed', ()=>{
 const {main,write}=splitScopes([YT,DFULL,DF,DF,YT]);
 assert.deepEqual(main,[YT]);
 assert.deepEqual(write,[DFULL,DF]);
});
test('drive.readonly stays in the main grant (accepted together with YouTube)', ()=>{
 assert.deepEqual(splitScopes([DR,YT]).write,[]);
});
test('number of Google screens', ()=>{
 assert.equal(consentSteps([GSC,YT]),1);
 assert.equal(consentSteps([DF]),1);
 assert.equal(consentSteps([YT,DF]),2);
 assert.equal(consentSteps([]),0);
 assert.deepEqual(DRIVE_WRITE_SCOPES,[DF,DFULL]);
});
