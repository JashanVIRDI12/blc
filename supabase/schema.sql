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
  ('india', '{}')
on conflict (key) do nothing;

-- ------------------------------------------------- make yourself admin
-- 1. Authentication → Users → Add user → your email and a password
--    (tick "Auto confirm user").
-- 2. Replace the email below with yours and run just these two lines:
--
-- insert into public.admins (user_id, email)
-- select id, email from auth.users where email = 'you@example.com';
