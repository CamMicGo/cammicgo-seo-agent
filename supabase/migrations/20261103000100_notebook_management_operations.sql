-- Allow device-local NotebookLM notebook inspection and verified rename.
-- Destructive deletion is intentionally not enabled until source inspection is validated.
alter table public.cmg_notebook_jobs drop constraint if exists cmg_notebook_jobs_operation_check;
alter table public.cmg_notebook_jobs add constraint cmg_notebook_jobs_operation_check
 check (operation in ('create','list','add_url_source','get','rename'));
