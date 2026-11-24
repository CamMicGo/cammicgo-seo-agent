import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decorateReactions} from '../lib/linkedin-reactions.ts';

test('reaction people get the hosted LinkedIn reaction picture and French label, nested results included', ()=>{
  const data={status:'ok',comments:{comments:[]},reactions:{byType:{like:1,funny:1},people:[{name:'A',reaction:'like'},{name:'B',reaction:'funny'},{name:'C',reaction:null}]}};
  decorateReactions(data,'https://seo.cammicgo.com');
  const p=data.reactions.people as Array<Record<string,unknown>>;
  assert.equal(p[0].reactionIconUrl,'https://seo.cammicgo.com/linkedin/reactions/like.png');
  assert.equal(p[1].reactionLabel,'Drôle');
  assert.equal(p[2].reactionIconUrl,undefined);
  assert.deepEqual((data.reactions as Record<string,unknown>).reactionIcons,{like:'https://seo.cammicgo.com/linkedin/reactions/like.png',funny:'https://seo.cammicgo.com/linkedin/reactions/funny.png'});
});
