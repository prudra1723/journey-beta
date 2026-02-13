-- Journey Beta (Supabase / Postgres) base schema for beta.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name_key text unique,
  display_name text,
  avatar_url text,
  cover_url text,
  bio text,
  location text,
  last_seen_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  group_type text,
  description text,
  event_date date,
  permissions jsonb,
  created_at timestamptz default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now()
);

create unique index if not exists group_members_unique
  on group_members (group_id, user_id);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  day_key text not null,
  start_time text not null,
  end_time text,
  title text not null,
  note text,
  map_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists plan_extras (
  plan_id uuid primary key references plans(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists plan_extras_group_idx
  on plan_extras (group_id);

create table if not exists timeline_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  text text,
  image_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists timeline_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references timeline_posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists timeline_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references timeline_posts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

create table if not exists media_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  image_url text not null,
  visibility text default 'group',
  created_by uuid references profiles(id),
  comments jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  text text,
  image_url text,
  reply_to jsonb,
  reactions jsonb,
  poll jsonb,
  mentions jsonb,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists chat_presence (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  last_seen timestamptz default now()
);

create unique index if not exists chat_presence_unique
  on chat_presence (group_id, user_id);

-- Reels (short video)
create table if not exists reels (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  video_url text not null,
  caption text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists reel_likes (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references reels(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (reel_id, user_id)
);

create table if not exists reel_comments (
  id uuid primary key default gen_random_uuid(),
  reel_id uuid references reels(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

-- Storage bucket for reels (public)
insert into storage.buckets (id, name, public)
values ('reels', 'reels', true)
on conflict (id) do nothing;
