// Unit tests for lib/chat-files.ts — run with: npm test
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as cf from '../lib/chat-files.ts';

test('ChatGPT file hosts: allowed suffixes only, no look-alikes', () => {
 for(const h of ['files.oaiusercontent.com','sdmntprnortheu.oaiusercontent.com','chatgpt.com','cdn.chatgpt.com','oaisdmntprwestus.blob.core.windows.net'])assert.equal(cf.chatFileHostAllowed(h),true,h);
 for(const h of ['chatgpt.com.evil.test','evil-chatgpt.com','oaiusercontent.com.evil.test','other.blob.core.windows.net','example.com'])assert.equal(cf.chatFileHostAllowed(h),false,h);
 assert.equal(cf.chatFileUrl('http://files.oaiusercontent.com/x'),null);
 assert.equal(cf.chatFileUrl('https://u:p@files.oaiusercontent.com/x'),null);
 assert.equal(cf.chatFileUrl('https://files.oaiusercontent.com:8443/x'),null);
 assert.ok(cf.chatFileUrl('https://files.oaiusercontent.com/file-abc?sig=1'));
});

test('readChatFile: file object, sandbox path, mobile reference', () => {
 const ok=cf.readChatFile({download_url:'https://files.oaiusercontent.com/x',file_id:'file-1',file_name:'banner.png',mime_type:'image/png'});
 assert.equal(ok.ok,true);
 const path=cf.readChatFile('/mnt/data/banner.png');
 assert.equal(path.ok,false);assert.equal(!path.ok&&path.problem.error,'local_path_not_transferable');
 const mobile=cf.readChatFile('chat_upload://image_0');
 assert.equal(!mobile.ok&&mobile.problem.error,'file_without_content');
 const noUrl=cf.readChatFile({file_id:'file-1'});
 assert.equal(!noUrl.ok&&noUrl.problem.error,'file_without_content');
 assert.equal(!cf.readChatFile(undefined).ok,true);
});

test('sniffType recognises files from their first bytes', () => {
 assert.equal(cf.sniffType(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0]))?.mime,'image/png');
 assert.equal(cf.sniffType(new Uint8Array([0xff,0xd8,0xff,0xe0]))?.mime,'image/jpeg');
 assert.equal(cf.sniffType(Buffer.from('GIF89a....'))?.mime,'image/gif');
 assert.equal(cf.sniffType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))?.mime,'image/webp');
 assert.equal(cf.sniffType(Buffer.from('%PDF-1.7'))?.mime,'application/pdf');
 assert.equal(cf.sniffType(Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from('....word/document.xml')]))?.ext,'docx');
 assert.equal(cf.sniffType(Buffer.from('\0\0\0\x18ftypheic'))?.mime,'image/heic');
 assert.equal(cf.sniffType(Buffer.from('hello')),null);
 assert.equal(cf.looksLikeText(Buffer.from('Bonjour, voici le texte.')),true);
 assert.equal(cf.looksLikeText(new Uint8Array([0x41,0,0x42])),false);
});

test('cleanFileName keeps the name, drops paths and forces the extension', () => {
 assert.equal(cf.cleanFileName('/mnt/data/Bannière CamMicGo.PNG','png'),'Bannière CamMicGo.png');
 assert.equal(cf.cleanFileName('..\\evil<>name.exe','pdf'),'evil name.pdf');
 assert.equal(cf.cleanFileName(null,'jpg','image'),'image.jpg');
 assert.ok(cf.cleanFileName('a'.repeat(300),'png').length<=114);
});
