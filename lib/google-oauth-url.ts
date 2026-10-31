/**
 * Google authorization URL for the remote MCP. Each grant contains exactly the requested scopes
 * (include_granted_scopes=false): Google refuses some combinations in one token, e.g. drive.file
 * together with YouTube scopes, so Drive writing is granted separately (see the callback).
 */
import {createHash,randomBytes} from 'node:crypto';
import {googleOAuthCallback} from '@/lib/oauth-callback';
import type {Credentials,Pending} from '@/lib/google-session';

export {DRIVE_WRITE_SCOPES,splitScopes} from '@/lib/google-scopes';
export type LinkedPending=Pending&{mcpUserId:string;authorizationId?:string;returnTo?:string;kind?:'main'|'drive_write';followUp?:string[];chained?:boolean};

export function googleAuthRequest(credentials:Credentials,scopes:string[],extra:Omit<LinkedPending,'state'|'verifier'|'credentials'|'issuedAt'>){
 const state=randomBytes(24).toString('hex'),verifier=randomBytes(32).toString('base64url');
 const pending:LinkedPending={state,verifier,credentials,issuedAt:Date.now(),...extra};
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:credentials.clientId,redirect_uri:googleOAuthCallback(),response_type:'code',scope:scopes.join(' '),access_type:'offline',
  include_granted_scopes:'false',prompt:'consent',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();
 return {url:url.toString(),pending};
}
