import {describe,expect,it,vi} from 'vitest';
import {dispatchLinkedInPersonalJob} from '../lib/linkedin-personal-dispatch';
import {canSendLinkedInMessage,validateLinkedInJob,type LinkedInPersonalJob} from '../lib/linkedin-personal-contract';

const base:LinkedInPersonalJob={operation:'messages_list',device:'android',requestId:'r1',accountId:'u1',payload:{}};
const guard=()=>({
 authorize:vi.fn(async()=>true),
 claim:vi.fn(async()=>true),
 consumeSendConfirmation:vi.fn(async()=>true),
});
describe('LinkedIn Android messaging safety boundary',()=>{
 it('rejects malformed search',()=>{
  expect(validateLinkedInJob({...base,operation:'people_search',payload:{query:''}})).toBe('invalid_query');
 });
 it('requires explicit confirmation and a token before sending',()=>{
  expect(validateLinkedInJob({...base,operation:'message_send',payload:{conversationId:'c1',messageText:'Hi'}})).toBe('explicit_confirmation_required');
  expect(validateLinkedInJob({...base,operation:'message_send',payload:{conversationId:'c1',messageText:'Hi',confirm:true}})).toBe('confirmation_token_required');
 });
 it('binds the confirmation to exact recipient, text, and expiry',()=>{
  const approval={conversationId:'c1',recipientDisplayName:'A',messageText:'Hi',confirmationToken:'secret',expiresAt:100};
  expect(canSendLinkedInMessage(approval,{conversationId:'c1',messageText:'Hi',confirmationToken:'secret',now:99})).toBe(true);
  expect(canSendLinkedInMessage(approval,{conversationId:'c2',messageText:'Hi',confirmationToken:'secret',now:99})).toBe(false);
  expect(canSendLinkedInMessage(approval,{conversationId:'c1',messageText:'Changed',confirmationToken:'secret',now:99})).toBe(false);
  expect(canSendLinkedInMessage(approval,{conversationId:'c1',messageText:'Hi',confirmationToken:'secret',now:100})).toBe(false);
 });
 it('rejects unpaired devices and duplicate requests without execution',async()=>{
  const g=guard();const execute=vi.fn(async()=>({status:'done' as const,data:[]}));
  g.authorize.mockResolvedValueOnce(false);
  expect(await dispatchLinkedInPersonalJob(base,g,execute)).toEqual({status:'error',code:'unauthorized_device'});
  g.claim.mockResolvedValueOnce(false);
  expect(await dispatchLinkedInPersonalJob(base,g,execute)).toEqual({status:'error',code:'duplicate_request'});
  expect(execute).not.toHaveBeenCalled();
 });
 it('does not send when confirmation was consumed or mismatched',async()=>{
  const g=guard();g.consumeSendConfirmation.mockResolvedValueOnce(false);
  const execute=vi.fn(async()=>({status:'done' as const,data:{sent:true}}));
  const job:LinkedInPersonalJob={...base,operation:'message_send',payload:{conversationId:'c1',messageText:'Hi',confirm:true,confirmationToken:'token'}};
  expect(await dispatchLinkedInPersonalJob(job,g,execute)).toEqual({status:'error',code:'confirmation_missing_or_used'});
  expect(execute).not.toHaveBeenCalled();
 });
});
