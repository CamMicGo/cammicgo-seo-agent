-- Safe additive migration: CamMicGo SEO Agent account ownership.
alter table cmg_private.accounts add column if not exists supabase_user_id uuid;
create unique index if not exists cmg_accounts_supabase_user_id_idx
 on cmg_private.accounts(supabase_user_id) where supabase_user_id is not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='cmg_accounts_supabase_user_fk') then
  alter table cmg_private.accounts add constraint cmg_accounts_supabase_user_fk
  foreign key(supabase_user_id) references auth.users(id) on delete cascade;
 end if;
end $$;
