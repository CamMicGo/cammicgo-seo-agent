-- Permit explicit, confirmed text-message jobs through the existing private relay.
alter table public.cmg_linkedin_jobs drop constraint if exists cmg_linkedin_jobs_operation_check;
alter table public.cmg_linkedin_jobs add constraint cmg_linkedin_jobs_operation_check
 check (operation in ('inbox','open','thread','back','feed','search','send'));
