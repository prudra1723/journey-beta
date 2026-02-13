-- RPC: join group by invite code (reusable)
create or replace function join_group_by_code(p_code text)
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
begin
  select * into g from groups where upper(code) = upper(p_code) limit 1;
  if g is null then
    return;
  end if;

  insert into group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return query
    select g.id, g.name, g.code, g.created_at, g.permissions;
end;
$$;
