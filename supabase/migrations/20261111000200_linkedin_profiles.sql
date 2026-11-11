-- LinkedIn read-only pages through the paired Android app: recommended jobs, company page and posts, person profile.
alter table public.cmg_linkedin_jobs drop constraint if exists cmg_linkedin_jobs_operation_check;
alter table public.cmg_linkedin_jobs add constraint cmg_linkedin_jobs_operation_check
 check (operation in ('inbox','open','thread','back','feed','search','send','company_search','network_suggestions','invite','attach','job_search','job_details','recommended_jobs','company_profile','company_posts','person_profile'));
