-- LinkedIn job offers (read-only) through the paired Android app: job_search and job_details.
alter table public.cmg_linkedin_jobs drop constraint if exists cmg_linkedin_jobs_operation_check;
alter table public.cmg_linkedin_jobs add constraint cmg_linkedin_jobs_operation_check
 check (operation in ('inbox','open','thread','back','feed','search','send','company_search','network_suggestions','invite','attach','job_search','job_details'));
