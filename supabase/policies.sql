-- Kjor etter schema.sql.
alter table public.entries enable row level security;
alter table public.tags enable row level security;
alter table public.entry_tags enable row level security;

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "own tags" on public.tags;
create policy "own tags" on public.tags for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists "own entry tags" on public.entry_tags;
create policy "own entry tags" on public.entry_tags for all to authenticated
using(exists(select 1 from public.entries e where e.id=entry_id and e.user_id=auth.uid()))
with check(exists(select 1 from public.entries e where e.id=entry_id and e.user_id=auth.uid()));

grant select,insert,update,delete on public.entries,public.tags,public.entry_tags to authenticated;
grant select on public.entries_with_tags to authenticated;
grant execute on function public.create_entry_with_tags(jsonb) to authenticated;
grant execute on function public.update_entry_with_tags(uuid,jsonb) to authenticated;
