/** Validate Supabase Auth OAuth bearer tokens on every remote MCP request.
 * This deliberately does not authorize access to a linked Google property.
 */
export type SupabaseMcpUser={id:string;clientId?:string};
const projectUrl='https://vfngxjsryklqldarkxhy.supabase.co';
export async function verifySupabaseMcpUser(authorization:string|null):Promise<SupabaseMcpUser|null>{
 if(!authorization?.startsWith('Bearer '))return null;
 const token=authorization.slice(7).trim();
 if(token.length<20||token.length>8192||!/^[-._~+/=A-Za-z0-9]+$/.test(token))return null;
 const apiKey=process.env.SUPABASE_PUBLISHABLE_KEY;
 if(!apiKey)return null;
 try{
  const response=await fetch(projectUrl+'/auth/v1/user',{headers:{Authorization:'Bearer '+token,apikey:apiKey},cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)return null;
  const body=await response.json() as {id?:unknown,role?:unknown,app_metadata?:unknown};
  if(typeof body.id!=='string'||!(/^[0-9a-f-]{36}$/i.test(body.id)))return null;
  return {id:body.id};
 }catch{return null}
}
