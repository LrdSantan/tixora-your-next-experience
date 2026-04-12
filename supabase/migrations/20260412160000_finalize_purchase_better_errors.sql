-- Clearer error when Paystack amount != sum of tier line items (helps debug silent RPC failures)

create or replace function public.finalize_purchase_after_payment(
  p_user_id uuid,
  p_reference text,
  p_verified_amount_kobo bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tier_line record;
  tier_rec public.ticket_tiers%rowtype;
  expected_total bigint := 0;
  result_rows jsonb;
begin
  if p_reference is null or length(trim(p_reference)) = 0 then
    raise exception 'invalid reference';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'no items';
  end if;

  if exists (select 1 from public.tickets where reference = p_reference limit 1) then
    if exists (
      select 1 from public.tickets
      where reference = p_reference and user_id is distinct from p_user_id
      limit 1
    ) then
      raise exception 'reference already used';
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'reference', t.reference,
          'amount_paid', t.amount_paid,
          'quantity', t.quantity,
          'event_title', e.title,
          'tier_name', tt.name,
          'venue', e.venue,
          'city', e.city,
          'date', e.date,
          'time', e.time
        )
        order by t.created_at
      ),
      '[]'::jsonb
    )
    into result_rows
    from public.tickets t
    join public.events e on e.id = t.event_id
    join public.ticket_tiers tt on tt.id = t.tier_id
    where t.reference = p_reference;

    return jsonb_build_object('tickets', result_rows);
  end if;

  for tier_line in
    select
      (el.value->>'tier_id')::uuid as tid,
      (el.value->>'quantity')::int as qty
    from jsonb_array_elements(p_items) as el
    order by (el.value->>'tier_id')::text
  loop
    if tier_line.qty is null or tier_line.qty <= 0 then
      raise exception 'invalid quantity';
    end if;

    select * into tier_rec
    from public.ticket_tiers
    where id = tier_line.tid
    for update;

    if not found then
      raise exception 'tier not found';
    end if;

    if tier_rec.remaining_quantity < tier_line.qty then
      raise exception 'insufficient stock';
    end if;

    expected_total := expected_total + (tier_rec.price::bigint * 100 * tier_line.qty);
  end loop;

  if expected_total <> p_verified_amount_kobo then
    raise exception 'amount mismatch: expected % kobo from cart tiers, Paystack reported % (check tier prices vs Paystack charge)',
      expected_total, p_verified_amount_kobo;
  end if;

  for tier_line in
    select
      (el.value->>'tier_id')::uuid as tid,
      (el.value->>'quantity')::int as qty
    from jsonb_array_elements(p_items) as el
    order by (el.value->>'tier_id')::text
  loop
    select * into tier_rec from public.ticket_tiers where id = tier_line.tid for update;

    update public.ticket_tiers
    set remaining_quantity = remaining_quantity - tier_line.qty
    where id = tier_line.tid;

    insert into public.tickets (user_id, event_id, tier_id, reference, amount_paid, quantity, status)
    values (
      p_user_id,
      tier_rec.event_id,
      tier_line.tid,
      p_reference,
      (tier_rec.price::bigint * 100 * tier_line.qty)::integer,
      tier_line.qty,
      'confirmed'
    );
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'reference', t.reference,
        'amount_paid', t.amount_paid,
        'quantity', t.quantity,
        'event_title', e.title,
        'tier_name', tt.name,
        'venue', e.venue,
        'city', e.city,
        'date', e.date,
        'time', e.time
      )
      order by t.created_at
    ),
    '[]'::jsonb
  )
  into result_rows
  from public.tickets t
  join public.events e on e.id = t.event_id
  join public.ticket_tiers tt on tt.id = t.tier_id
  where t.reference = p_reference;

  return jsonb_build_object('tickets', result_rows);
end;
$$;

revoke all on function public.finalize_purchase_after_payment(uuid, text, bigint, jsonb) from public;
grant execute on function public.finalize_purchase_after_payment(uuid, text, bigint, jsonb) to service_role;
