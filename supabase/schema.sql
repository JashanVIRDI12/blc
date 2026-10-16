-- Baba Luxury Cars: the stock, collections and site settings behind the
-- website and its admin portal (/admin/).
--
-- Run this whole file once in Supabase: Dashboard → SQL Editor → New query →
-- paste → Run. It is safe to run again; it only adds what is missing.
-- Then make yourself an admin with the snippet at the very end.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- cars
create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  make text not null,
  model text not null,
  variant text,
  body text,
  year int check (year between 1950 and 2100),
  kilometres int check (kilometres >= 0),
  owners int check (owners between 0 and 20),
  fuel text,
  transmission text,
  colour text,
  registration text,
  location text,
  -- Asking price in rupees. Null shows "Price on request".
  price bigint check (price >= 0),
  -- available · reserved · coming_soon · sold · hidden (a draft, never shown).
  status text not null default 'available' check (status in ('available', 'reserved', 'coming_soon', 'sold', 'hidden')),
  -- A short line on the card, such as "Arriving mid-November".
  note text,
  featured boolean not null default false,
  featured_rank int not null default 0,
  sort_order int not null default 0,
  collections text[] not null default '{}',
  photos text[] not null default '{}',
  highlights text[] not null default '{}',
  description text,
  specs jsonb not null default '[]',
  inspection jsonb,
  model3d text,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cars_status_idx on public.cars (status);
create index if not exists cars_featured_idx on public.cars (featured, featured_rank);

-- -------------------------------------------------------- collections
-- Curated groups, such as "Signature" or "Family". A car joins a collection
-- by listing its slug in cars.collections.
create table if not exists public.collections (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  subtitle text,
  cover text,
  sort_order int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------- settings
-- One row per group: contact, home, collection, listing. Public: never
-- store a secret here.
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------- admins
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

-- updated_at, and the date a car was sold.
create or replace function public.touch_car() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'sold' and (tg_op = 'INSERT' or old.status is distinct from 'sold') then
    new.sold_at := coalesce(new.sold_at, now());
  elsif new.status <> 'sold' then
    new.sold_at := null;
  end if;
  return new;
end $$;
drop trigger if exists cars_touch on public.cars;
create trigger cars_touch before insert or update on public.cars
  for each row execute function public.touch_car();

-- ------------------------------------------------- row level security
alter table public.cars enable row level security;
alter table public.collections enable row level security;
alter table public.settings enable row level security;
alter table public.admins enable row level security;

drop policy if exists "cars: visitors read published" on public.cars;
create policy "cars: visitors read published" on public.cars
  for select using (status <> 'hidden' or public.is_admin());
drop policy if exists "cars: admins write" on public.cars;
create policy "cars: admins write" on public.cars
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "collections: visitors read visible" on public.collections;
create policy "collections: visitors read visible" on public.collections
  for select using (visible or public.is_admin());
drop policy if exists "collections: admins write" on public.collections;
create policy "collections: admins write" on public.collections
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "settings: everyone reads" on public.settings;
create policy "settings: everyone reads" on public.settings
  for select using (true);
drop policy if exists "settings: admins write" on public.settings;
create policy "settings: admins write" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Admins are added here in SQL only, never through the website.
drop policy if exists "admins: read own" on public.admins;
create policy "admins: read own" on public.admins
  for select using (user_id = auth.uid() or public.is_admin());

-- --------------------------------------------------------- car photos
insert into storage.buckets (id, name, public)
values ('car-photos', 'car-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "car photos: admins upload" on storage.objects;
create policy "car photos: admins upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'car-photos' and public.is_admin());
drop policy if exists "car photos: admins update" on storage.objects;
create policy "car photos: admins update" on storage.objects
  for update to authenticated using (bucket_id = 'car-photos' and public.is_admin());
drop policy if exists "car photos: admins delete" on storage.objects;
create policy "car photos: admins delete" on storage.objects
  for delete to authenticated using (bucket_id = 'car-photos' and public.is_admin());

-- ------------------------------------------- the dealership's ad rules
-- Every ad follows the dealership's rules (docs/ADMIN.md): the registration
-- is shown only by its first characters (cars.registration holds just that;
-- the full number is kept privately, below); a fancy or VIP number wears a
-- tag with its digits; insurance reads Valid or Expired, never a date (a
-- date, when known, turns Valid into Expired on its own).
alter table public.cars add column if not exists plate_tag text check (plate_tag in ('vip', 'fancy'));
alter table public.cars add column if not exists plate_number text;
alter table public.cars add column if not exists insurance text check (insurance in ('valid', 'expired'));
alter table public.cars add column if not exists insurance_until date;
-- The photograph a card turns to under the pointer (usually the cabin).
alter table public.cars add column if not exists hover_photo text;

-- What only the dealership sees: the full registration, which stock a car
-- belongs to (BLC, A.M., Park & Sale…) and internal notes.
create table if not exists public.car_private (
  car_id uuid primary key references public.cars on delete cascade,
  registration text,
  stock text,
  notes text,
  updated_at timestamptz not null default now()
);
alter table public.car_private enable row level security;
drop policy if exists "car private: admins only" on public.car_private;
create policy "car private: admins only" on public.car_private
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------- enquiries
-- Every enquiry and valuation sent from the site lands here, for the
-- admin's inbox. Visitors may only add one; nobody but an admin can read
-- them.
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'enquiry' check (kind in ('enquiry', 'valuation')),
  name text check (char_length(name) <= 120),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 160),
  subject text check (char_length(subject) <= 300),
  message text check (char_length(message) <= 4000),
  car text check (char_length(car) <= 200),
  details jsonb not null default '{}',
  page text check (char_length(page) <= 300),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists enquiries_created_idx on public.enquiries (created_at desc);
-- Concierge requests (modifications and anything else for a car) too.
alter table public.enquiries drop constraint if exists enquiries_kind_check;
alter table public.enquiries add constraint enquiries_kind_check check (kind in ('enquiry', 'valuation', 'concierge'));
alter table public.enquiries enable row level security;
drop policy if exists "enquiries: visitors send" on public.enquiries;
create policy "enquiries: visitors send" on public.enquiries
  for insert to anon, authenticated with check (status = 'new' and notes is null and pg_column_size(details) < 4000);
drop policy if exists "enquiries: admins manage" on public.enquiries;
create policy "enquiries: admins manage" on public.enquiries
  for all using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------- deliveries
-- Photographs of cars handed over to their new owners, for the site's
-- gallery.
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  photo text not null,
  caption text,
  visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
-- The city or state it went to, for the home page's map.
alter table public.deliveries add column if not exists city text;
alter table public.deliveries enable row level security;
drop policy if exists "deliveries: visitors read shown" on public.deliveries;
create policy "deliveries: visitors read shown" on public.deliveries
  for select using (visible or public.is_admin());
drop policy if exists "deliveries: admins write" on public.deliveries;
create policy "deliveries: admins write" on public.deliveries
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------- insights
-- Anonymous counts for the admin's Insights (api/track.js writes them): a
-- page seen, a car looked at (once per visit), a tap to call, WhatsApp, get
-- directions or shortlist. Nothing that identifies a visitor is kept: no
-- cookie, no IP address; the site the visit came from (its name only, on
-- the visit's first page), the kind of device, and the city the host reports.
-- Visitors can only add a row; only the dealership can read them.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('view', 'car_view', 'whatsapp', 'call', 'directions', 'shortlist')),
  car_id uuid references public.cars(id) on delete set null,
  path text check (char_length(path) <= 200),
  source text check (char_length(source) <= 80),
  device text check (device in ('mobile', 'tablet', 'desktop')),
  city text check (char_length(city) <= 80),
  region text check (char_length(region) <= 80),
  country text check (char_length(country) <= 2),
  created_at timestamptz not null default now()
);
create index if not exists events_created_idx on public.events (created_at desc);
create index if not exists events_car_idx on public.events (car_id, created_at desc) where car_id is not null;
alter table public.events enable row level security;
drop policy if exists "events: visitors count" on public.events;
create policy "events: visitors count" on public.events
  for insert to anon, authenticated with check (created_at > now() - interval '5 minutes' and created_at <= now() + interval '1 minute');
drop policy if exists "events: admins read" on public.events;
create policy "events: admins read" on public.events
  for select using (public.is_admin());
drop policy if exists "events: admins clear" on public.events;
create policy "events: admins clear" on public.events
  for delete using (public.is_admin());

-- The Insights page's figures for the last `days` days (and the days
-- before, to compare), totalled here so the admin never downloads the rows.
-- A visit is the first page of a visit (the row that carries its source).
create or replace function public.insights(days integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  span interval := make_interval(days => greatest(1, least(coalesce(days, 30), 365)));
  since timestamptz := now() - span;
begin
  if not public.is_admin() then
    raise exception 'Only the dealership can read insights.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'since', since,
    'totals', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) as n from events where created_at >= since group by kind) t), '{}'::jsonb),
    'previous', coalesce((select jsonb_object_agg(kind, n) from (select kind, count(*) as n from events where created_at >= since - span and created_at < since group by kind) t), '{}'::jsonb),
    'visits', (select count(*) from events where kind = 'view' and source is not null and created_at >= since),
    'visits_before', (select count(*) from events where kind = 'view' and source is not null and created_at >= since - span and created_at < since),
    'daily', coalesce((select jsonb_agg(t order by t.day) from (
      select (created_at at time zone 'Asia/Kolkata')::date as day,
        count(*) filter (where kind = 'view' and source is not null) as visits,
        count(*) filter (where kind = 'car_view') as car_views,
        count(*) filter (where kind in ('whatsapp', 'call')) as contacts
      from events where created_at >= since group by 1) t), '[]'::jsonb),
    'cars', coalesce((select jsonb_agg(t) from (
      select car_id,
        count(*) filter (where kind = 'car_view' and created_at >= since) as views,
        count(*) filter (where kind = 'car_view') as views_all,
        count(*) filter (where kind = 'whatsapp' and created_at >= since) as whatsapp,
        count(*) filter (where kind = 'call' and created_at >= since) as calls,
        count(*) filter (where kind = 'shortlist' and created_at >= since) as shortlists,
        max(created_at) filter (where kind = 'car_view') as last_view
      from events where car_id is not null group by car_id) t), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(t) from (select source as name, count(*) as n from events where kind = 'view' and source is not null and created_at >= since group by 1 order by 2 desc limit 12) t), '[]'::jsonb),
    'cities', coalesce((select jsonb_agg(t) from (select city as name, region, count(*) as n from events where kind = 'view' and source is not null and city is not null and created_at >= since group by 1, 2 order by 3 desc limit 12) t), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(t) from (select device as name, count(*) as n from events where kind = 'view' and source is not null and device is not null and created_at >= since group by 1 order by 2 desc) t), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(t) from (select path as name, count(*) as n from events where kind = 'view' and created_at >= since group by 1 order by 2 desc limit 12) t), '[]'::jsonb)
  );
end $$;
revoke all on function public.insights(integer) from public, anon;
grant execute on function public.insights(integer) to authenticated;

-- ------------------------------------------------------ starting data
insert into public.collections (slug, title, subtitle, sort_order) values
  ('signature', 'Signature', 'Flagships, chosen for their presence.', 1),
  ('family', 'Family', 'Seven seats, long journeys, every comfort.', 2),
  ('performance', 'Performance', 'For the drive itself.', 3),
  ('adventure', 'Adventure', 'Built to go further.', 4)
on conflict (slug) do nothing;

insert into public.settings (key, value) values
  ('contact', '{}'),
  ('home', '{}'),
  ('collection', '{}'),
  ('listing', '{}'),
  ('concierge', '{}'),
  ('india', '{}'),
  ('whatsapp', '{}')
on conflict (key) do nothing;

-- ------------------------------------------------- make yourself admin
-- 1. Authentication → Users → Add user → your email and a password
--    (tick "Auto confirm user").
-- 2. Replace the email below with yours and run just these two lines:
--
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'you@example.com';
