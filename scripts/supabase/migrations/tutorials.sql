begin;

-- Only the lesson catalog is persisted. Practice sessions and rewards stay local.
create table public.tutorials (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  thumbnail text not null,
  duration_minutes integer not null default 5 check (duration_minutes > 0),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.tutorials enable row level security;
revoke all on table public.tutorials from anon, authenticated;
grant select on table public.tutorials to authenticated;
grant all on table public.tutorials to service_role;

create policy tutorials_read_published on public.tutorials
  for select to authenticated using (is_published = true);

insert into public.tutorials (slug, title, description, thumbnail, duration_minutes, sort_order)
values (
  'new-player-fishing',
  'Buổi câu đầu tiên',
  'Chọn trang bị, quăng cần và giằng co với cá. Luyện tập tự do với trang bị có sẵn.',
  '/tutorial/new-player-fishing/area/map.png',
  5, 10
);

commit;
