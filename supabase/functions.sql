-- RPC: join group by invite code (reusable)
create or replace function join_group_by_code(p_code text, p_name text)
returns table (
  id uuid,
  name text,
  code text,
  created_at timestamptz,
  permissions jsonb
)
language plpgsql
security definer
as $$
declare
  g record;
  norm_name text;
  existing_count int;
begin
  select * into g
  from groups gr
  where upper(gr.code) = upper(p_code)
  limit 1;
  if g is null then
    return;
  end if;

  if p_name is not null and length(trim(p_name)) > 0 then
    norm_name := lower(trim(regexp_replace(p_name, '\s+', ' ', 'g')));
    select count(*) into existing_count
    from group_members gm
    join profiles p on p.id = gm.user_id
    where gm.group_id = g.id
      and gm.user_id <> auth.uid()
      and lower(trim(regexp_replace(coalesce(p.display_name, ''), '\s+', ' ', 'g'))) = norm_name;
    if existing_count > 0 then
      raise exception 'That name is already used in this group. Please change your name.';
    end if;
  end if;

  insert into group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return query
    select g.id, g.name, g.code, g.created_at, g.permissions;
end;
$$;
