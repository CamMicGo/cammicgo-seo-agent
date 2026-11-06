-- LinkedIn attachments through the paired Android app. Files never go through Supabase: the phone downloads
-- them from the assistant's file storage into its private cache and deletes them after the message is sent.
-- 1. The queue refused every operation added after 'send' (attach, invite, company_search,
--    network_suggestions): their jobs could never be created.
alter table public.cmg_linkedin_jobs drop constraint if exists cmg_linkedin_jobs_operation_check;
alter table public.cmg_linkedin_jobs add constraint cmg_linkedin_jobs_operation_check
 check (operation in ('inbox','open','thread','back','feed','search','send','company_search','network_suggestions','invite','attach'));
-- 2. A job that acts on LinkedIn (send, invite, attach) is handed out once: a stale claim is never retried,
--    so a slow phone can never send the same message twice.
create or replace function public.cmg_claim_linkedin_job(p_user_id uuid,p_device_id uuid)
returns table(id uuid,operation text,payload jsonb)
language plpgsql security invoker set search_path=public as $$
begin
 return query update public.cmg_linkedin_jobs j
 set status='claimed',device_id=p_device_id,claimed_at=now()
 where j.id=(select q.id from public.cmg_linkedin_jobs q
 where q.user_id=p_user_id and q.expires_at>now() and
 (q.status='pending' or (q.status='claimed' and q.claimed_at<now()-interval '90 seconds' and q.operation not in ('send','invite','attach')))
 order by q.created_at limit 1 for update skip locked)
 returning j.id,j.operation,j.payload;
end $$;
revoke all on function public.cmg_claim_linkedin_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cmg_claim_linkedin_job(uuid,uuid) to service_role;
