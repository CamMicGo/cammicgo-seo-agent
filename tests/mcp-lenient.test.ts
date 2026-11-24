import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {lenientJson} from '../lib/mcp-lenient.ts';
test('object/array arguments sent as JSON text (old cached schema) are parsed and validated the same way', ()=>{
 const S=lenientJson(z.object({u:z.string(),g:z.array(z.object({label:z.string()})).max(2).optional().default([]),a:z.object({x:z.array(z.string()).optional().default([])}).optional()}));
 assert.deepEqual(S.parse({u:'x',g:'[{"label":"A"}]',a:'{"x":["q"]}'}),{u:'x',g:[{label:'A'}],a:{x:['q']}});
 assert.deepEqual(S.parse({u:'x',g:[{label:'B'}]}),{u:'x',g:[{label:'B'}]});
 assert.deepEqual(S.parse({u:'x'}),{u:'x',g:[]});
 assert.equal(S.safeParse({u:'x',g:'not json'}).success,false);
 assert.equal(S.safeParse({u:'x',g:'[{"label":1}]'}).success,false,'same validation');
 assert.equal(S.safeParse({u:'x',g:'[{"label":"a"},{"label":"b"},{"label":"c"}]'}).success,false,'same limits');
 assert.equal(S.safeParse({u:'{}'}).success,true,'plain strings untouched');
});
