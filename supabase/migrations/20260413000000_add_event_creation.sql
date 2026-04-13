-- 1. Add new columns to events
alter table public.events
  add column if not exists organizer_id uuid references auth.users(id) on delete cascade,
  add column if not exists organizer_email text,
  add column if not exists status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  add column if not exists cover_image_url text default '';

-- Pre-approve any existing mocked events
update public.events set status = 'approved' where organizer_id is null;

-- 2. Storage policies
create policy "Auth upload event-covers" 
  on storage.objects for insert 
  to authenticated 
  with check (bucket_id = 'event-covers');

-- 3. Event policies
create policy "Public read approved events" 
  on public.events for select 
  using (status = 'approved');

create policy "Users read own events" 
  on public.events for select 
  to authenticated 
  using (organizer_id = auth.uid());

create policy "Admin read all events" 
  on public.events for select 
  to authenticated 
  using ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');

create policy "Users insert own events" 
  on public.events for insert 
  to authenticated 
  with check (organizer_id = auth.uid());

create policy "Admin update all events" 
  on public.events for update 
  to authenticated 
  using ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');

create policy "Admin delete all events" 
  on public.events for delete 
  to authenticated 
  using ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');

-- 4. Ticket tier policies
create policy "Users insert own ticket tiers" 
  on public.ticket_tiers for insert 
  to authenticated 
  with check (exists (select 1 from public.events e where e.id = event_id and e.organizer_id = auth.uid()));

create policy "Admin manage all ticket tiers" 
  on public.ticket_tiers for all 
  to authenticated 
  using ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');

-- 5. Tickets admin policy
create policy "Admin manage all tickets" 
  on public.tickets for all 
  to authenticated 
  using ((auth.jwt() ->> 'email') = 'yusufquadir50@gmail.com');

-- 6. RPC for admin transactions
create or replace function public.get_recent_transactions()
returns table (
  id uuid,
  buyer_email varchar,
  event_title text,
  tier_name text,
  quantity int,
  amount_paid int,
  created_at timestamptz
)
language sql
security definer
as $$
  select 
    t.id, 
    u.email::varchar as buyer_email, 
    e.title as event_title, 
    tt.name as tier_name, 
    t.quantity, 
    t.amount_paid, 
    t.created_at
  from public.tickets t
  join public.events e on e.id = t.event_id
  join public.ticket_tiers tt on tt.id = t.tier_id
  join auth.users u on u.id = t.user_id
  order by t.created_at desc
  limit 50;
$$;

revoke all on function public.get_recent_transactions() from public;
grant execute on function public.get_recent_transactions() to authenticated;