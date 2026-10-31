// Unit tests for lib/google-drive.ts — run with: npm test
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as d from '../lib/google-drive.ts';

test('Drive IDs are validated (no query injection through IDs)', () => {
  assert.ok(d.isDriveId('root'));
  assert.ok(d.isDriveId('1AbC_def-GHIjkl0123'));
  assert.ok(!d.isDriveId("abc' or trashed=true or '"));
  assert.ok(!d.isDriveId('short'));
});

test('query values are escaped', () => {
  assert.equal(d.escapeQuery("l'été \\ test"), "l\\'été \\\\ test");
  assert.equal(d.buildSearchQuery({name: "O'Brien"}), "name contains 'O\\'Brien' and trashed = false");
});

test('list query: folder, kind and trash filters', () => {
  assert.equal(d.buildListQuery({folderId: 'root'}), "'root' in parents and trashed = false");
  assert.equal(d.buildListQuery({kind: 'folders'}), "mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  assert.equal(d.buildListQuery({kind: 'files', includeTrashed: true}), "mimeType != 'application/vnd.google-apps.folder'");
});

test('search query: name + type aliases + folder + dates', () => {
  const q = d.buildSearchQuery({name: 'rapport', type: 'markdown', folderId: '1AbC_def-GHIjkl0123', modifiedAfter: '2026-01-01T00:00:00Z'});
  assert.equal(q, "name contains 'rapport' and (mimeType = 'text/markdown' or mimeType = 'text/x-markdown') and '1AbC_def-GHIjkl0123' in parents and modifiedTime > '2026-01-01T00:00:00Z' and trashed = false");
  assert.equal(d.buildSearchQuery({type: 'image'}), "mimeType contains 'image/' and trashed = false");
  assert.equal(d.buildSearchQuery({type: 'document'}), "mimeType = 'application/vnd.google-apps.document' and trashed = false");
  assert.equal(d.buildSearchQuery({type: 'application/pdf'}), "mimeType = 'application/pdf' and trashed = false");
});

test('pagination params: page size capped, token passed, order dropped for full-text', () => {
  const p = d.listParams("name contains 'a'", 500, 'name', 'TOKEN');
  assert.equal(p.get('pageSize'), String(d.DRIVE_LIMITS.maxPageSize));
  assert.equal(p.get('pageToken'), 'TOKEN');
  assert.equal(p.get('orderBy'), 'folder,name');
  assert.equal(p.get('supportsAllDrives'), 'true');
  assert.equal(p.get('corpora'), 'allDrives');
  assert.ok(p.get('fields')!.includes('nextPageToken'));
  const ft = d.listParams("fullText contains 'seo'", 10, 'modified');
  assert.equal(ft.get('orderBy'), null);
  const sd = d.listParams('trashed = false', 10, 'modified', undefined, true, '0ABCdefGHIjklUk9PVA');
  assert.equal(sd.get('corpora'), 'drive');
  assert.equal(sd.get('driveId'), '0ABCdefGHIjklUk9PVA');
});

test('read plan by MIME type', () => {
  assert.deepEqual(d.readPlan('application/vnd.google-apps.document'), {mode: 'export', exportMime: 'text/plain'});
  assert.equal(d.readPlan('application/vnd.google-apps.spreadsheet').mode, 'export');
  assert.equal(d.readPlan('text/plain').mode, 'media');
  assert.equal(d.readPlan('text/csv').mode, 'media');
  assert.equal(d.readPlan('text/markdown').mode, 'media');
  assert.equal(d.readPlan('application/json').mode, 'media');
  assert.equal(d.readPlan('application/pdf').mode, 'pdf');
  assert.equal(d.readPlan('image/png').mode, 'unsupported');
  assert.equal(d.readPlan('application/vnd.google-apps.folder').mode, 'unsupported');
  assert.equal(d.readPlan('application/vnd.google-apps.form').mode, 'unsupported');
});

test('bounded text windows with nextOffset', () => {
  const text = Array.from({length: 3000}, (_, i) => 'line ' + i).join('\n');
  const first = d.sliceText(text, 0, 5000);
  assert.ok(first.returnedChars <= 5000);
  assert.ok(first.text.endsWith('\n'));
  assert.equal(first.complete, false);
  let offset = first.nextOffset!, joined = first.text, guard = 0;
  while (offset != null && guard++ < 100) { const p = d.sliceText(text, offset, 5000); joined += p.text; offset = p.nextOffset!; }
  assert.equal(joined, text);
  assert.equal(d.sliceText('short', 0, 5000).complete, true);
  assert.equal(d.sliceText('short', 99, 5000).text, '');
});

test('storage quota: real values, and no invented capacity when the limit is missing', () => {
  const q = d.computeQuota({limit: '16106127360', usage: '8053063680', usageInDrive: '1073741824', usageInDriveTrash: '0'});
  assert.equal(q.percentUsed, 50);
  assert.equal(q.remainingBytes, 8053063680);
  assert.equal(q.limit, '15.0 GB');
  assert.equal(q.unlimited, false);
  const u = d.computeQuota({usage: '123456789', usageInDrive: '100'});
  assert.equal(u.limitBytes, null);
  assert.equal(u.percentUsed, null);
  assert.equal(u.remainingBytes, null);
  assert.equal(u.unlimited, true);
  assert.equal(d.computeQuota(undefined).usageBytes, null);
});

test('errors: 403 scope, 404, 429, API disabled, storage full', () => {
  assert.equal(d.driveError(403, {error: {details: [{reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'}], message: 'Request had insufficient authentication scopes.'}}).error, 'missing_google_permission');
  assert.equal(d.driveError(404, {}).error, 'not_found');
  assert.equal(d.driveError(429, {}).error, 'rate_limited');
  assert.equal(d.driveError(403, {error: {errors: [{reason: 'userRateLimitExceeded'}]}}).error, 'rate_limited');
  assert.equal(d.driveError(403, {error: {errors: [{reason: 'accessNotConfigured'}]}}).error, 'drive_api_disabled');
  assert.equal(d.driveError(403, {error: {errors: [{reason: 'storageQuotaExceeded'}]}}).error, 'storage_full');
  assert.equal(d.driveError(403, {error: {errors: [{reason: 'forbidden'}]}}).error, 'forbidden');
});

test('names: cleaned, and duplicates never overwritten', () => {
  assert.equal(d.cleanName('  rapport\u0007.md '), 'rapport.md');
  assert.equal(d.cleanName('   '), null);
  assert.equal(d.cleanName('x'.repeat(256)), null);
  assert.equal(d.uniqueName('notes.md', new Set(['notes.md'])), 'notes (2).md');
  assert.equal(d.uniqueName('notes.md', new Set(['notes.md', 'notes (2).md'])), 'notes (3).md');
  assert.equal(d.uniqueName('Dossier', new Set(['Dossier'])), 'Dossier (2)');
  assert.equal(d.uniqueName('new.txt', new Set(['old.txt'])), 'new.txt');
});

test('multipart upload body', () => {
  const b = d.multipartBody({name: 'a.txt'}, Buffer.from('hello'), 'text/plain', 'XYZ').toString();
  assert.ok(b.startsWith('--XYZ\r\nContent-Type: application/json'));
  assert.ok(b.includes('{"name":"a.txt"}'));
  assert.ok(b.includes('Content-Type: text/plain\r\n\r\nhello'));
  assert.ok(b.endsWith('--XYZ--'));
});

test('slimFile marks folders and readability', () => {
  const f = d.slimFile({id: '1AbC_def-GHIjkl0123', name: 'Docs', mimeType: d.FOLDER_MIME});
  assert.equal(f.kind, 'folder');
  assert.equal(f.readable, false);
  const g = d.slimFile({id: '1AbC_def-GHIjkl0124', name: 'a.pdf', mimeType: 'application/pdf', size: '2048'});
  assert.equal(g.size, '2.00 KB');
  assert.equal(g.readable, true);
});
