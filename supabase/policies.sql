-- Enable RLS
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table plans enable row level security;
alter table order_lists enable row level security;
alter table timeline_posts enable row level security;
alter table timeline_images enable row level security;
alter table timeline_likes enable row level security;
alter table timeline_comments enable row level security;
alter table media_items enable row level security;
alter table chat_messages enable row level security;
alter table direct_messages enable row level security;
alter table chat_presence enable row level security;
alter table band_profiles enable row level security;
alter table band_booking_requests enable row level security;
alter table band_request_messages enable row level security;
alter table reels enable row level security;
alter table reel_likes enable row level security;
alter table reel_comments enable row level security;
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

create policy "groups_select_public_timeline"
  on groups for select
  to authenticated
  using (timeline_public = true);

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

create policy "group_members_select_self"
  on group_members for select
  using (user_id = auth.uid());

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

-- Order lists: members can read/write
create policy "order_lists_member_select"
  on order_lists for select
  using (exists (
    select 1 from group_members gm
    where gm.group_id = order_lists.group_id and gm.user_id = auth.uid()
  ));

create policy "order_lists_member_insert"
  on order_lists for insert
  with check (exists (
    select 1 from group_members gm
    where gm.group_id = order_lists.group_id and gm.user_id = auth.uid()
  ));

create policy "order_lists_member_update"
  on order_lists for update
  using (exists (
    select 1 from group_members gm
    where gm.group_id = order_lists.group_id and gm.user_id = auth.uid()
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

drop policy if exists "timeline_posts_public_read" on timeline_posts;
create policy "timeline_posts_public_read"
  on timeline_posts for select
  to authenticated
  using (true);

create policy "timeline_images_member_access"
  on timeline_images for all
  using (exists (
    select 1 from group_members gm
    join timeline_posts tp on tp.id = timeline_images.post_id
    where gm.group_id = tp.group_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from group_members gm
    join timeline_posts tp on tp.id = timeline_images.post_id
    where gm.group_id = tp.group_id and gm.user_id = auth.uid()
  ));

drop policy if exists "timeline_images_public_read" on timeline_images;
create policy "timeline_images_public_read"
  on timeline_images for select
  to authenticated
  using (true);

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

drop policy if exists "timeline_comments_public_read" on timeline_comments;
create policy "timeline_comments_public_read"
  on timeline_comments for select
  to authenticated
  using (true);

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

drop policy if exists "timeline_likes_public_read" on timeline_likes;
create policy "timeline_likes_public_read"
  on timeline_likes for select
  to authenticated
  using (true);

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

-- Direct messages: only sender/recipient within group
create policy "direct_messages_select_participants"
  on direct_messages for select
  using (
    auth.uid() in (sender_id, recipient_id)
    and exists (
      select 1 from group_members gm
      where gm.group_id = direct_messages.group_id
        and gm.user_id = auth.uid()
    )
  );

create policy "direct_messages_insert_sender"
  on direct_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from group_members gm
      where gm.group_id = direct_messages.group_id
        and gm.user_id = sender_id
    )
    and exists (
      select 1 from group_members gm
      where gm.group_id = direct_messages.group_id
        and gm.user_id = recipient_id
    )
  );

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

-- Marketplace: band profiles (public read)
create policy "band_profiles_select_all"
  on band_profiles for select
  using (true);

create policy "band_profiles_insert_owner"
  on band_profiles for insert
  with check (auth.uid() = owner_id);

create policy "band_profiles_update_owner"
  on band_profiles for update
  using (auth.uid() = owner_id);

create policy "band_profiles_delete_owner"
  on band_profiles for delete
  using (auth.uid() = owner_id);

-- Booking requests: only requester + band owner
create policy "band_requests_select_participants"
  on band_booking_requests for select
  using (
    requester_id = auth.uid()
    or exists (
      select 1 from band_profiles bp
      where bp.id = band_booking_requests.band_id
        and bp.owner_id = auth.uid()
    )
  );

create policy "band_requests_insert_requester"
  on band_booking_requests for insert
  with check (auth.uid() = requester_id);

create policy "band_requests_update_participants"
  on band_booking_requests for update
  using (
    requester_id = auth.uid()
    or exists (
      select 1 from band_profiles bp
      where bp.id = band_booking_requests.band_id
        and bp.owner_id = auth.uid()
    )
  );

-- Request messages: only participants
create policy "band_request_messages_select_participants"
  on band_request_messages for select
  using (
    exists (
      select 1
      from band_booking_requests r
      join band_profiles bp on bp.id = r.band_id
      where r.id = band_request_messages.request_id
        and (r.requester_id = auth.uid() or bp.owner_id = auth.uid())
    )
  );

create policy "band_request_messages_insert_participants"
  on band_request_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from band_booking_requests r
      join band_profiles bp on bp.id = r.band_id
      where r.id = band_request_messages.request_id
        and (r.requester_id = auth.uid() or bp.owner_id = auth.uid())
    )
  );

-- Reels: members only
create policy "reels_member_access"
  on reels for all
  using (exists (
    select 1 from group_members gm
    where gm.group_id = reels.group_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from group_members gm
    where gm.group_id = reels.group_id and gm.user_id = auth.uid()
  ));

create policy "reel_likes_member_access"
  on reel_likes for all
  using (exists (
    select 1 from reels r
    join group_members gm on gm.group_id = r.group_id
    where r.id = reel_likes.reel_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from reels r
    join group_members gm on gm.group_id = r.group_id
    where r.id = reel_likes.reel_id and gm.user_id = auth.uid()
  ));

create policy "reel_comments_member_access"
  on reel_comments for all
  using (exists (
    select 1 from reels r
    join group_members gm on gm.group_id = r.group_id
    where r.id = reel_comments.reel_id and gm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from reels r
    join group_members gm on gm.group_id = r.group_id
    where r.id = reel_comments.reel_id and gm.user_id = auth.uid()
  ));

-- Storage: reels bucket (authenticated users only)
create policy "reels_storage_select"
  on storage.objects for select
  using (bucket_id = 'reels');

create policy "reels_storage_insert"
  on storage.objects for insert
  with check (bucket_id = 'reels' and auth.uid() is not null);
