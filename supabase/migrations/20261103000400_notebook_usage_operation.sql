alter table public.cmg_notebook_jobs drop constraint if exists cmg_notebook_jobs_operation_check;
alter table public.cmg_notebook_jobs add constraint cmg_notebook_jobs_operation_check check (operation in ('create','list','add_url_source','get','rename','delete_preview','delete','add_text_source','add_drive_source','usage'));
