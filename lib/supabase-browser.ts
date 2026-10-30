'use client';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
const publicKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
let client:SupabaseClient|null=null;
/** Browser Supabase client (email sign-in). Created lazily: Next.js prerenders client pages during builds. */
export function supabaseBrowser(){
 if(!publicKey)throw new Error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
 client??=createClient('https://vfngxjsryklqldarkxhy.supabase.co',publicKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 return client;
}
export const supabaseConfigured=!!publicKey;
