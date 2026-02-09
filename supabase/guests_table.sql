create table if not exists public.guests (
  id text primary key,
  name text not null,
  room text not null,
  company text not null,
  check_in text,
  check_out text,
  tariff text,
  plan text,
  has_breakfast boolean not null default false,
  used_today boolean not null default false,
  consumption_date date default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guests enable row level security;

drop policy if exists "Allow anon full access to guests" on public.guests;
create policy "Allow anon full access to guests"
  on public.guests
  for all
  to anon
  using (true)
  with check (true);

grant all on table public.guests to anon;
