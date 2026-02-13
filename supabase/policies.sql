-- Enable RLS
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table plans enable row level security;
alter table timeline_posts enable row level security;
alter table timeline_likes enable row level security;
alter table timeline_comments enable row level security;
alter table media_items enable row level security;
alter table chat_messages enable row level security;
alter table chat_presence enable row level security;
alter table plan_extras enable row level security;

-- Profiles: user can read all profiles, but only update self
create policy "profiles_select_all"
  on profiles for select
  using (true);

create policy "profiles_insert_self"
  on profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_self"
  on profiles for update
  using (auth.uid() = id);

-- Groups: members can read; only members (host/admin) can update
create policy "groups_select_member"
  on groups for select
  using (exists (
    select 1 from group_members gm
    where gm.group_id = id and gm.user_id = auth.uid()
  ));

create policy "groups_insert_authenticated"
  on groups for insert
  with check (auth.uid() is not null);

create policy "groups_update_host_admin"
  on groups for update
  using (exists (
    select 1 from group_members gm
    where gm.group_id = id
      and gm.user_id = auth.uid()
      and gm.role in ('host','admin')
  ));

-- Group members: members can read membership; host/admin can insert others
create policy "group_members_select_group"
  on group_members for select
  using (exists (
    select 1 from group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
  ));

create policy "group_members_insert_host_admin"
  on group_members for insert
  with check (
    (auth.uid() = user_id and role = 'host')
    or exists (
      select 1 from group_members gm
      where gm.group_id = group_members.group_id
        and gm.user_id = auth.uid()
        and gm.role in ('host','admin')
    )
  );

-- Plans: members can read/write
create policy "plans_member_access"
  on plans for all
  using (exists (
    select 1 from group_members gm
    where gm.group_id = plans.group_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from group_members gm
    where gm.group_id = plans.group_id and gm.user_id = auth.uid()
  ));

create policy "plan_extras_member_access"
  on plan_extras for all
  using (exists (
    select 1 from group_members gm
    where gm.group_id = plan_extras.group_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from group_members gm
    where gm.group_id = plan_extras.group_id and gm.user_id = auth.uid()
  ));

-- Timeline: members only
create policy "timeline_posts_member_access"
  on timeline_posts for all
  using (exists (
    select 1 from group_members gm
    where gm.group_id = timeline_posts.group_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from group_members gm
    where gm.group_id = timeline_posts.group_id and gm.user_id = auth.uid()
  ));

create policy "timeline_comments_member_access"
  on timeline_comments for all
  using (exists (
    select 1 from group_members gm
    join timeline_posts tp on tp.id = timeline_comments.post_id
    where gm.group_id = tp.group_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from group_members gm
    join timeline_posts tp on tp.id = timeline_comments.post_id
    where gm.group_id = tp.group_id and gm.user_id = auth.uid()
  ));

create policy "timeline_likes_member_access"
  on timeline_likes for all
  using (exists (
    select 1 from group_members gm
    join timeline_posts tp on tp.id = timeline_likes.post_id
    where gm.group_id = tp.group_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from group_members gm
    join timeline_posts tp on tp.id = timeline_likes.post_id
    where gm.group_id = tp.group_id and gm.user_id = auth.uid()
  ));

-- Media: group-only (default), shared (any auth), private (owner)
create policy "media_select"
  on media_items for select
  using (
    visibility = 'shared'
    or (visibility = 'private' and created_by = auth.uid())
    or (visibility = 'group' and exists (
      select 1 from group_members gm
      where gm.group_id = media_items.group_id and gm.user_id = auth.uid()
    ))
  );

create policy "media_insert_member"
  on media_items for insert
  with check (exists (
    select 1 from group_members gm
    where gm.group_id = media_items.group_id and gm.user_id = auth.uid()
  ));

create policy "media_delete_owner"
  on media_items for delete
  using (created_by = auth.uid());

-- Chat: members only
create policy "chat_messages_member_access"
  on chat_messages for all
  using (exists (
    select 1 from group_members gm
    where gm.group_id = chat_messages.group_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from group_members gm
    where gm.group_id = chat_messages.group_id and gm.user_id = auth.uid()
  ));

create policy "chat_presence_member_access"
  on chat_presence for all
  using (exists (
    select 1 from group_members gm
    where gm.group_id = chat_presence.group_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from group_members gm
    where gm.group_id = chat_presence.group_id and gm.user_id = auth.uid()
  ));
