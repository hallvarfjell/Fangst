-- Fangst v0.1.0. Kjor hele filen i Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  body text not null check (length(trim(body)) > 0),
  context text not null default 'private' check (context in ('private','work')),
  entry_type text not null default 'note' check (entry_type in ('note','idea','journal','observation','decision','question','follow_up','reference')),
  status text not null default 'new' check (status in ('new','considering','planned','done','parked')),
  event_date timestamptz not null default now(),
  long_text text,
  external_url text,
  archived boolean not null default false,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id,name)
);
create table if not exists public.entry_tags (
  entry_id uuid not null references public.entries(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key(entry_id,tag_id)
);
create index if not exists entries_user_event_idx on public.entries(user_id,event_date desc);
create index if not exists entries_user_context_idx on public.entries(user_id,context);
create index if not exists tags_user_name_idx on public.tags(user_id,name);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at before update on public.entries for each row execute function public.set_updated_at();

create or replace view public.entries_with_tags with (security_invoker=true) as
select e.*,coalesce(array_agg(t.name order by t.name) filter(where t.name is not null),'{}') as tags
from public.entries e left join public.entry_tags et on et.entry_id=e.id left join public.tags t on t.id=et.tag_id
group by e.id;

create or replace function public.create_entry_with_tags(p_data jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_tag text; v_tag_id uuid;
begin
 insert into entries(title,body,context,entry_type,status,event_date,long_text,external_url)
 values(nullif(p_data->>'title',''),p_data->>'body',coalesce(p_data->>'context','private'),coalesce(p_data->>'entry_type','note'),coalesce(p_data->>'status','new'),coalesce((p_data->>'event_date')::timestamptz,now()),nullif(p_data->>'long_text',''),nullif(p_data->>'external_url','')) returning id into v_id;
 for v_tag in select distinct trim(value) from jsonb_array_elements_text(coalesce(p_data->'tags','[]'::jsonb)) where trim(value)<>'' loop
   insert into tags(name) values(v_tag) on conflict(user_id,name) do update set name=excluded.name returning id into v_tag_id;
   insert into entry_tags(entry_id,tag_id) values(v_id,v_tag_id) on conflict do nothing;
 end loop; return v_id;
end $$;

create or replace function public.update_entry_with_tags(p_entry_id uuid,p_data jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare v_tag text; v_tag_id uuid;
begin
 update entries set title=nullif(p_data->>'title',''),body=p_data->>'body',context=p_data->>'context',entry_type=p_data->>'entry_type',status=p_data->>'status',event_date=(p_data->>'event_date')::timestamptz,long_text=nullif(p_data->>'long_text',''),external_url=nullif(p_data->>'external_url','') where id=p_entry_id;
 delete from entry_tags where entry_id=p_entry_id;
 for v_tag in select distinct trim(value) from jsonb_array_elements_text(coalesce(p_data->'tags','[]'::jsonb)) where trim(value)<>'' loop
   insert into tags(name) values(v_tag) on conflict(user_id,name) do update set name=excluded.name returning id into v_tag_id;
   insert into entry_tags(entry_id,tag_id) values(p_entry_id,v_tag_id) on conflict do nothing;
 end loop;
end $$;
