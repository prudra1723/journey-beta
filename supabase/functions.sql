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
  existing_user uuid;
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
    select gm.user_id into existing_user
    from group_members gm
    join profiles p on p.id = gm.user_id
    where gm.group_id = g.id
      and lower(trim(regexp_replace(coalesce(p.display_name, ''), '\s+', ' ', 'g'))) = norm_name
    limit 1;

    if existing_user is not null and existing_user <> auth.uid() then
      -- replace membership to keep names unique per group
      delete from group_members
      where group_id = g.id and user_id = existing_user;
    end if;
  end if;

  insert into group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return query
    select g.id, g.name, g.code, g.created_at, g.permissions;
end;
$$;
