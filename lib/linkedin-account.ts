/**
 * LinkedIn status shown on the account page (server side). Never returns a secret or a token: only the
 * user's own app summary, their connection, and whether the shared CamMicGo app can be used.
 */
import {isAdmin} from '@/lib/account';
import {daysLeft,LI_REDIRECT} from '@/lib/linkedin';
import {readLinkedInConnection,sharedClientInfo,socialClientSummary} from '@/lib/social-store';

export async function linkedinStatus(userId:string){
 const [client,conn,shared,admin]=await Promise.all([socialClientSummary(userId,'linkedin'),readLinkedInConnection(userId).catch(()=>null),
  sharedClientInfo('linkedin').catch(()=>null),isAdmin(userId).catch(()=>false)]);
 return {redirectUri:LI_REDIRECT,admin,client,
  shared:{available:!!shared,...(admin&&shared?{clientId:shared.clientId,source:shared.source,mine:shared.updatedBy===userId}:{})},
  connection:conn?{name:conn.name,expiresAt:new Date(conn.expiresAt).toISOString(),daysLeft:daysLeft(conn.expiresAt),canPost:conn.scopes.includes('w_member_social'),app:conn.app??'own'}:null};
}
