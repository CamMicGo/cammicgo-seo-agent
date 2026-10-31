/**
 * Google scope groups (pure, client-safe). Google refuses drive.file together with YouTube scopes in one
 * authorization ("scopes that cannot be requested together"), so Drive writing always gets its own grant.
 */
export const DRIVE_WRITE_SCOPES=['https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/drive'];
export const isDriveWriteScope=(s:string)=>DRIVE_WRITE_SCOPES.includes(s);

/** Splits the requested scopes into the main grant and the separate Drive write grant (duplicates removed). */
export function splitScopes(scopes:string[]){
 const uniq=[...new Set(scopes)];
 return {main:uniq.filter(s=>!isDriveWriteScope(s)),write:uniq.filter(isDriveWriteScope)};
}

/** Number of Google consent screens needed for these scopes (0, 1 or 2). */
export function consentSteps(scopes:string[]){const {main,write}=splitScopes(scopes);return (main.length?1:0)+(write.length?1:0);}
