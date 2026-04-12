-- Run in Supabase SQL Editor, or via: supabase db push
-- Public read for anon + authenticated; adjust when you add writes.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  date date not null,
  time text not null,
  venue text not null,
  city text not null,
  category text not null,
  banner_url text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  description text not null,
  price integer not null check (price >= 0),
  total_quantity integer not null check (total_quantity >= 0),
  remaining_quantity integer not null check (remaining_quantity >= 0)
);

create index if not exists ticket_tiers_event_id_idx on public.ticket_tiers (event_id);

alter table public.events enable row level security;
alter table public.ticket_tiers enable row level security;

drop policy if exists "Public read events" on public.events;
create policy "Public read events"
  on public.events for select
  to anon, authenticated
  using (true);

drop policy if exists "Public read ticket_tiers" on public.ticket_tiers;
create policy "Public read ticket_tiers"
  on public.ticket_tiers for select
  to anon, authenticated
  using (true);

-- Seed sample events (safe to run once; skip if you already have data)
insert into public.events (title, description, date, time, venue, city, category, banner_url, created_at)
select v.title, v.description, v.date::date, v.time, v.venue, v.city, v.category, v.banner_url, v.created_at::timestamptz
from (values
  ('Burna Boy Live in Concert', 'Experience the African Giant live at Eko Convention Centre. A night of unforgettable afrobeats, high-energy performances, and surprise guest appearances. Get ready for the concert of the year!', '2026-05-15', '19:00', 'Eko Convention Centre', 'Lagos', 'Concerts', '', '2026-01-01'),
  ('Wizkid: Made in Lagos Tour', 'Star Boy takes the stage for an exclusive Lagos homecoming show. Feel the vibes of Essence, Joro, and all the hits live.', '2026-06-20', '20:00', 'Tafawa Balewa Square', 'Lagos', 'Concerts', '', '2026-01-02'),
  ('Lagos City Marathon 2026', 'Join thousands of runners in Africa''s premier marathon. From Ozumba Mbadiwe to Eko Atlantic — 42km of pure adrenaline through the heart of Lagos.', '2026-03-08', '06:30', 'National Stadium, Surulere', 'Lagos', 'Sports', '', '2026-01-03'),
  ('NPFL Super Cup: Enyimba vs Rangers', 'The biggest rivalry in Nigerian football comes alive. Watch Enyimba take on Rangers in the Super Cup final at the Moshood Abiola Stadium.', '2026-04-25', '16:00', 'Moshood Abiola National Stadium', 'Abuja', 'Sports', '', '2026-01-04'),
  ('Bovi: Man on Fire Comedy Special', 'Nigeria''s king of comedy brings his sharpest material yet. Two hours of non-stop laughter guaranteed. Special appearances by your favorite comedians.', '2026-07-10', '19:30', 'The Civic Centre, Victoria Island', 'Lagos', 'Comedy', '', '2026-01-05'),
  ('Abuja Food & Music Festival', 'A 3-day celebration of Nigerian cuisine, live music, and culture. Over 50 food vendors, 20 artists, workshops, and family fun zones.', '2026-08-15', '10:00', 'Eagles Square', 'Abuja', 'Festivals', '', '2026-01-06')
) as v(title, description, date, time, venue, city, category, banner_url, created_at)
where not exists (select 1 from public.events limit 1);

insert into public.ticket_tiers (event_id, name, description, price, total_quantity, remaining_quantity)
select e.id, t.name, t.description, t.price, t.total_quantity, t.remaining_quantity
from public.events e
cross join lateral (values
  ('Regular', 'General admission standing', 15000, 5000, 3200),
  ('VIP', 'Reserved seating with complimentary drinks', 50000, 1000, 450),
  ('VVIP', 'Front row, backstage access, meet & greet', 150000, 200, 80)
) as t(name, description, price, total_quantity, remaining_quantity)
where e.title = 'Burna Boy Live in Concert'
  and not exists (select 1 from public.ticket_tiers tt where tt.event_id = e.id);

insert into public.ticket_tiers (event_id, name, description, price, total_quantity, remaining_quantity)
select e.id, t.name, t.description, t.price, t.total_quantity, t.remaining_quantity
from public.events e
cross join lateral (values
  ('General', 'Open ground access', 10000, 8000, 5500),
  ('VIP', 'Elevated viewing area with bar', 45000, 1500, 800)
) as t(name, description, price, total_quantity, remaining_quantity)
where e.title = 'Wizkid: Made in Lagos Tour'
  and not exists (select 1 from public.ticket_tiers tt where tt.event_id = e.id);

insert into public.ticket_tiers (event_id, name, description, price, total_quantity, remaining_quantity)
select e.id, t.name, t.description, t.price, t.total_quantity, t.remaining_quantity
from public.events e
cross join lateral (values
  ('Participant', 'Race entry with timing chip and jersey', 5000, 20000, 12000),
  ('Spectator VIP', 'VIP viewing area with refreshments', 20000, 500, 300)
) as t(name, description, price, total_quantity, remaining_quantity)
where e.title = 'Lagos City Marathon 2026'
  and not exists (select 1 from public.ticket_tiers tt where tt.event_id = e.id);

insert into public.ticket_tiers (event_id, name, description, price, total_quantity, remaining_quantity)
select e.id, t.name, t.description, t.price, t.total_quantity, t.remaining_quantity
from public.events e
cross join lateral (values
  ('Regular', 'Standard seating', 3000, 30000, 20000),
  ('VIP', 'Covered VIP box with refreshments', 25000, 2000, 1200),
  ('VVIP', 'Executive box with lounge access', 75000, 500, 350)
) as t(name, description, price, total_quantity, remaining_quantity)
where e.title = 'NPFL Super Cup: Enyimba vs Rangers'
  and not exists (select 1 from public.ticket_tiers tt where tt.event_id = e.id);

insert into public.ticket_tiers (event_id, name, description, price, total_quantity, remaining_quantity)
select e.id, t.name, t.description, t.price, t.total_quantity, t.remaining_quantity
from public.events e
cross join lateral (values
  ('Regular', 'Standard seating', 10000, 2000, 1400),
  ('VIP', 'Front section with complimentary drinks', 35000, 500, 280)
) as t(name, description, price, total_quantity, remaining_quantity)
where e.title = 'Bovi: Man on Fire Comedy Special'
  and not exists (select 1 from public.ticket_tiers tt where tt.event_id = e.id);

insert into public.ticket_tiers (event_id, name, description, price, total_quantity, remaining_quantity)
select e.id, t.name, t.description, t.price, t.total_quantity, t.remaining_quantity
from public.events e
cross join lateral (values
  ('Day Pass', 'Single day access', 5000, 10000, 7500),
  ('Weekend Pass', 'All 3 days access', 12000, 5000, 3800),
  ('VIP Weekend', 'All access + VIP lounge + free food vouchers', 30000, 1000, 600)
) as t(name, description, price, total_quantity, remaining_quantity)
where e.title = 'Abuja Food & Music Festival'
  and not exists (select 1 from public.ticket_tiers tt where tt.event_id = e.id);
