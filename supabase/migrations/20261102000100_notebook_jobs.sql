create table if not exists public.cmg_notebook_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 operation text not null check (operation in ('create','list','add_url_source')),
 payload jsonb not null default '{}'::jsonb,
 status text not null default 'pending' check (status in ('pending','claimed','done','error')),
 device_id uuid references public.cmg_devices(id) on delete set null,
 result jsonb,
 error text,
 created_at timestamptz not null default now(),
 claimed_at timestamptz,
 completed_at timestamptz,
 expires_at timestamptz not null default now() + interval '10 minutes'
);
create index if not exists cmg_notebook_jobs_queue on public.cmg_notebook_jobs(user_id,status,created_at);
alter table public.cmg_notebook_jobs enable row level security;
revoke all on public.cmg_notebook_jobs from anon,authenticated;
create or replace function public.cmg_claim_notebook_job(p_user_id uuid,p_device_id uuid)
returns table(id uuid,operation text,payload jsonb)
language plpgsql security invoker set search_path=public as $$
begin
 return query update public.cmg_notebook_jobs j set status='claimed',device_id=p_device_id,claimed_at=now()
 where j.id=(select q.id from public.cmg_notebook_jobs q where q.user_id=p_user_id and q.expires_at>now() and (q.status='pending' or (q.status='claimed' and q.claimed_at<now()-interval '90 seconds')) order by q.created_at limit 1 for update skip locked)
 returning j.id,j.operation,j.payload;
end $$;
revoke all on function public.cmg_claim_notebook_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cmg_claim_notebook_job(uuid,uuid) to service_role;
