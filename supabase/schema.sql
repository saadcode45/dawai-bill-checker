-- Dawai Bill Checker — Supabase schema
-- Run in Supabase Dashboard > SQL Editor, on the SAME project Memora uses
-- (dzqmpwjarunwjskmjzcm) or any new project. Idempotent: safe to run more
-- than once. All tables use the dawai_ prefix so Memora tables are untouched.
--
-- IMPORTANT — Auth setting (do this once, in Supabase Dashboard):
--   Authentication > Sign In / Providers > Email > "Confirm email" = OFF.
--   With confirmation OFF, sign-up returns a session immediately and never
--   sends an email, so new pharmacy owners are never blocked by email rate
--   limits (the same fix Memora needed). No approval gate: the pilot owner
--   is the first account to create a pharmacy.
--
-- RLS: a pharmacy's price list is public by design — patients must see it
-- without logging in. So SELECT is open to everyone (anon + authenticated).
-- INSERT / UPDATE / DELETE are owner-only: the caller must own the pharmacy
-- (dawai_pharmacies.owner_id = auth.uid()). The service-role key bypasses
-- RLS and is for server-side API routes only.

create extension if not exists pgcrypto;

-- One row per pharmacy. slug is the public QR link: /p/<slug>.
create table if not exists public.dawai_pharmacies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists dawai_pharmacies_owner_idx on public.dawai_pharmacies(owner_id);
create index if not exists dawai_pharmacies_slug_idx on public.dawai_pharmacies(slug);

-- One row per medicine in a pharmacy's price list.
-- pack_price is Rs for ONE full pack / box / bottle. 0 means "not set yet".
-- pack_qty is how many units are inside one pack (10 tabs, 1 inj, 10 sachets).
-- similar_medicine_id is set by the owner: if this medicine is out of stock,
-- bill the similar one instead (shown as a normal line, no explanation).
create table if not exists public.dawai_medicines (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.dawai_pharmacies(id) on delete cascade,
  name text not null,
  type text not null default 'Tab'
    check (type in ('Tab','Cap','Syrup','Inj','Sachet','Cream','Drops')),
  pack_price numeric not null default 0,
  pack_qty int not null default 10,
  pack_unit text not null default 'tabs',
  similar_medicine_id uuid references public.dawai_medicines(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists dawai_medicines_pharmacy_idx on public.dawai_medicines(pharmacy_id);
create index if not exists dawai_medicines_name_idx on public.dawai_medicines(pharmacy_id, lower(name));

alter table public.dawai_pharmacies enable row level security;
alter table public.dawai_medicines enable row level security;

-- Pharmacies: anyone may read (patients need it); only the owner may write.
drop policy if exists "dawai_pharmacies read all" on public.dawai_pharmacies;
create policy "dawai_pharmacies read all" on public.dawai_pharmacies
  for select using (true);
drop policy if exists "dawai_pharmacies insert own" on public.dawai_pharmacies;
create policy "dawai_pharmacies insert own" on public.dawai_pharmacies
  for insert with check (auth.uid() = owner_id);
drop policy if exists "dawai_pharmacies update own" on public.dawai_pharmacies;
create policy "dawai_pharmacies update own" on public.dawai_pharmacies
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "dawai_pharmacies delete own" on public.dawai_pharmacies;
create policy "dawai_pharmacies delete own" on public.dawai_pharmacies
  for delete using (auth.uid() = owner_id);

-- Medicines: anyone may read (the price list is public); only the owning
-- pharmacy's owner may write. Ownership is checked through the pharmacy row.
drop policy if exists "dawai_medicines read all" on public.dawai_medicines;
create policy "dawai_medicines read all" on public.dawai_medicines
  for select using (true);
drop policy if exists "dawai_medicines insert own" on public.dawai_medicines;
create policy "dawai_medicines insert own" on public.dawai_medicines
  for insert with check (
    exists (select 1 from public.dawai_pharmacies p
            where p.id = pharmacy_id and p.owner_id = auth.uid())
  );
drop policy if exists "dawai_medicines update own" on public.dawai_medicines;
create policy "dawai_medicines update own" on public.dawai_medicines
  for update using (
    exists (select 1 from public.dawai_pharmacies p
            where p.id = pharmacy_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.dawai_pharmacies p
            where p.id = pharmacy_id and p.owner_id = auth.uid())
  );
drop policy if exists "dawai_medicines delete own" on public.dawai_medicines;
create policy "dawai_medicines delete own" on public.dawai_medicines
  for delete using (
    exists (select 1 from public.dawai_pharmacies p
            where p.id = pharmacy_id and p.owner_id = auth.uid())
  );
