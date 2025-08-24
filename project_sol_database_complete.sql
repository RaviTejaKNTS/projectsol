-- =========================================
-- PROJECT SOL - Complete Database Schema
-- =========================================
-- One-shot solution combining:
-- - Complete database schema (tables, indexes, triggers)
-- - Row Level Security (RLS) policies
-- - Profile creation triggers for new users
-- - All necessary permissions and grants
-- =========================================
-- Requirements: Postgres 14+, Supabase, pgcrypto
-- Run as a single migration on a clean DB.
-- =========================================

begin;

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Utility: touch updated_at ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Utility: ensure tasks.column_id belongs to same board ----------
create or replace function f_enforce_task_column_board_consistency()
returns trigger language plpgsql as $$
declare
  col_board uuid;
begin
  select board_id into col_board from board_columns where id = new.column_id;
  if col_board is null then
    raise exception 'column % does not exist', new.column_id;
  end if;
  if new.board_id is distinct from col_board then
    raise exception 'Task(board_id) % must match Column(board_id) %', new.board_id, col_board;
  end if;
  return new;
end $$;

-- ---------- USERS / PROFILES ----------
drop table if exists profiles cascade;
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
before update on profiles
for each row execute function set_updated_at();

-- ---------- BOARDS ----------
drop table if exists boards cascade;
create table boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  title       text not null default 'Board',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_boards_user on boards(user_id);
drop trigger if exists trg_boards_updated_at on boards;
create trigger trg_boards_updated_at
before update on boards
for each row execute function set_updated_at();

-- ---------- BOARD SETTINGS (per-board retention & visibility) ----------
drop table if exists board_settings cascade;
create table board_settings (
  board_id          uuid primary key references boards(id) on delete cascade,
  show_completed    boolean not null default false,
  save_deleted      boolean not null default true,
  deleted_retention interval not null default '7 days',
  auto_cleanup      boolean not null default true,
  last_cleanup_at   timestamptz
);

-- Auto-create settings row when a board is created
create or replace function f_board_settings_init()
returns trigger language plpgsql as $$
begin
  insert into board_settings (board_id) values (new.id)
  on conflict (board_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_board_settings_init on boards;
create trigger trg_board_settings_init
after insert on boards
for each row execute function f_board_settings_init();

-- ---------- COLUMNS (lists) ----------
drop table if exists board_columns cascade;
create table board_columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  title       text not null,
  position    int  not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (board_id, position)
);
create index if not exists idx_cols_board_pos on board_columns(board_id, position);
drop trigger if exists trg_columns_updated_at on board_columns;
create trigger trg_columns_updated_at
before update on board_columns
for each row execute function set_updated_at();

-- ---------- TASKS ----------
drop table if exists tasks cascade;
create table tasks (
  id            uuid primary key default gen_random_uuid(),
  board_id      uuid not null references boards(id) on delete cascade,
  column_id     uuid not null references board_columns(id) on delete cascade,
  title         text not null,
  description   text,
  priority      text not null default 'Medium' check (priority in ('Low','Medium','High','Urgent')),
  due_at        timestamptz,
  completed     boolean not null default false,
  completed_at  timestamptz,
  position      int  not null,                     -- order within the column
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- ensure column and task share the same board
drop trigger if exists trg_tasks_board_consistency on tasks;
create trigger trg_tasks_board_consistency
before insert or update of board_id, column_id on tasks
for each row execute function f_enforce_task_column_board_consistency();

create index if not exists idx_tasks_board_col_pos
  on tasks(board_id, column_id, position)
  where deleted_at is null;
create index if not exists idx_tasks_due_open
  on tasks(due_at)
  where completed = false and deleted_at is null;
drop trigger if exists trg_tasks_updated_at on tasks;
create trigger trg_tasks_updated_at
before update on tasks
for each row execute function set_updated_at();

-- ---------- SUBTASKS ----------
drop table if exists subtasks cascade;
create table subtasks (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references tasks(id) on delete cascade,
  title       text not null,
  completed   boolean not null default false,
  position    int not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (task_id, position)
);
create index if not exists idx_subtasks_task on subtasks(task_id);
drop trigger if exists trg_subtasks_updated_at on subtasks;
create trigger trg_subtasks_updated_at
before update on subtasks
for each row execute function set_updated_at();

-- ---------- LABELS (board-scoped) ----------
drop table if exists labels cascade;
create table labels (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  name        text not null,
  color       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Enforce unique label names per board (expression must be an index, not a constraint)
drop index if exists ux_labels_board_lower_name;
create unique index ux_labels_board_lower_name
  on labels (board_id, lower(name));
create index if not exists idx_labels_board on labels(board_id);
drop trigger if exists trg_labels_updated_at on labels;
create trigger trg_labels_updated_at
before update on labels
for each row execute function set_updated_at();

-- ---------- TASK ↔ LABEL (many-to-many) ----------
drop table if exists task_labels cascade;
create table task_labels (
  task_id   uuid not null references tasks(id) on delete cascade,
  label_id  uuid not null references labels(id) on delete cascade,
  primary key (task_id, label_id)
);
create index if not exists idx_task_labels_task  on task_labels(task_id);
create index if not exists idx_task_labels_label on task_labels(label_id);

-- ---------- OPTIONAL: user-level settings (theme, shortcuts) ----------
drop table if exists user_settings cascade;
create table user_settings (
  user_id         uuid primary key references profiles(id) on delete cascade,
  theme           text not null default 'light' check (theme in ('light','dark')),
  shortcuts       jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_user_settings_updated_at on user_settings;
create trigger trg_user_settings_updated_at
before update on user_settings
for each row execute function set_updated_at();

-- ---------- Purge helpers (per-board retention) ----------
create or replace function f_purge_deleted_tasks(p_board uuid)
returns void language sql as $$
  with cfg as (
    select save_deleted, deleted_retention
    from board_settings
    where board_id = p_board
  )
  delete from tasks t
  using cfg
  where t.board_id = p_board
    and t.deleted_at is not null
    and (
      cfg.save_deleted = false
      or t.deleted_at < now() - cfg.deleted_retention
    );
$$;

create or replace function f_purge_all_boards()
returns void language plpgsql as $$
declare
  r record;
begin
  for r in
    select b.id
    from boards b
    join board_settings s on s.board_id = b.id
    where s.auto_cleanup = true
  loop
    perform f_purge_deleted_tasks(r.id);
    update board_settings set last_cleanup_at = now() where board_id = r.id;
  end loop;
end $$;

-- =========================================
-- Row Level Security (RLS) - Enable on all tables
-- =========================================
alter table profiles       enable row level security;
alter table boards         enable row level security;
alter table board_settings enable row level security;
alter table board_columns  enable row level security;
alter table tasks          enable row level security;
alter table subtasks       enable row level security;
alter table labels         enable row level security;
alter table task_labels    enable row level security;
alter table user_settings  enable row level security;

-- =========================================
-- RLS Policies - Comprehensive security setup
-- =========================================

-- Profiles table policies
drop policy if exists "profiles_select_own" on profiles;
drop policy if exists "profiles_upsert_own"  on profiles;
drop policy if exists "profiles_update_own"  on profiles;
drop policy if exists "Users can view own profile" on profiles;
drop policy if exists "Users can insert own profile" on profiles;
drop policy if exists "Users can update own profile" on profiles;

create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());
create policy "profiles_upsert_own" on profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- Boards table policies
drop policy if exists "boards_owner_all" on boards;
drop policy if exists "Users can view own boards" on boards;
drop policy if exists "Users can insert own boards" on boards;
drop policy if exists "Users can update own boards" on boards;
drop policy if exists "Users can delete own boards" on boards;

create policy "boards_owner_all" on boards
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Board Settings table policies
drop policy if exists "board_settings_owner_all" on board_settings;
drop policy if exists "Users can view settings of own boards" on board_settings;
drop policy if exists "Users can insert settings for own boards" on board_settings;
drop policy if exists "Users can update settings of own boards" on board_settings;

create policy "board_settings_owner_all" on board_settings
  for all using (
    exists (select 1 from boards b where b.id = board_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from boards b where b.id = board_id and b.user_id = auth.uid())
  );

-- Columns table policies
drop policy if exists "cols_owner_all" on board_columns;
drop policy if exists "Users can view columns of own boards" on board_columns;
drop policy if exists "Users can insert columns in own boards" on board_columns;
drop policy if exists "Users can update columns in own boards" on board_columns;
drop policy if exists "Users can delete columns in own boards" on board_columns;

create policy "cols_owner_all" on board_columns
  for all using (
    exists (select 1 from boards b where b.id = board_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from boards b where b.id = board_id and b.user_id = auth.uid())
  );

-- Tasks table policies
drop policy if exists "tasks_owner_all" on tasks;
drop policy if exists "Users can view tasks in own boards" on tasks;
drop policy if exists "Users can insert tasks in own boards" on tasks;
drop policy if exists "Users can update tasks in own boards" on tasks;
drop policy if exists "Users can delete tasks in own boards" on tasks;

create policy "tasks_owner_all" on tasks
  for all using (
    exists (select 1 from boards b where b.id = board_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from boards b where b.id = board_id and b.user_id = auth.uid())
  );

-- Subtasks table policies
drop policy if exists "subtasks_owner_all" on subtasks;
drop policy if exists "Users can view subtasks of own tasks" on subtasks;
drop policy if exists "Users can insert subtasks in own tasks" on subtasks;
drop policy if exists "Users can update subtasks of own tasks" on subtasks;
drop policy if exists "Users can delete subtasks of own tasks" on subtasks;

create policy "subtasks_owner_all" on subtasks
  for all using (
    exists (
      select 1
      from tasks t join boards b on b.id = t.board_id
      where t.id = task_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from tasks t join boards b on b.id = t.board_id
      where t.id = task_id and b.user_id = auth.uid()
    )
  );

-- Labels table policies
drop policy if exists "labels_owner_all" on labels;
drop policy if exists "Users can view labels of own boards" on labels;
drop policy if exists "Users can insert labels in own boards" on labels;
drop policy if exists "Users can update labels in own boards" on labels;
drop policy if exists "Users can delete labels in own boards" on labels;

create policy "labels_owner_all" on labels
  for all using (
    exists (select 1 from boards b where b.id = board_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from boards b where b.id = board_id and b.user_id = auth.uid())
  );

-- Task ↔ Label table policies
drop policy if exists "task_labels_owner_all" on task_labels;
drop policy if exists "Users can view task labels of own tasks" on task_labels;
drop policy if exists "Users can insert task labels for own tasks" on task_labels;
drop policy if exists "Users can delete task labels of own tasks" on task_labels;

create policy "task_labels_owner_all" on task_labels
  for all using (
    exists (
      select 1
      from tasks t join boards b on b.id = t.board_id
      where t.id = task_id and b.user_id = auth.uid()
    )
    and
    exists (
      select 1
      from labels l join boards b2 on b2.id = l.board_id
      where l.id = label_id and b2.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from tasks t join boards b on b.id = t.board_id
      where t.id = task_id and b.user_id = auth.uid()
    )
    and
    exists (
      select 1
      from labels l join boards b2 on b2.id = l.board_id
      where l.id = label_id and b2.user_id = auth.uid()
    )
  );

-- User Settings table policies
drop policy if exists "Users can view own settings" on user_settings;
drop policy if exists "Users can insert own settings" on user_settings;
drop policy if exists "Users can update own settings" on user_settings;

create policy "Users can view own settings" on user_settings
  for select using (auth.uid() = user_id);
create policy "Users can insert own settings" on user_settings
  for insert with check (auth.uid() = user_id);
create policy "Users can update own settings" on user_settings
  for update using (auth.uid() = user_id);

-- =========================================
-- Profile Creation Trigger for New Users
-- =========================================

-- Function to handle new user profile creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email, 'User'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    display_name = coalesce(excluded.display_name, profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
    updated_at = now();
  
  return new;
end;
$$;

-- Drop triggers if they exist
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;

-- Create trigger for new user registration
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Also handle updates to user metadata
create trigger on_auth_user_updated
  after update on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public.handle_new_user();

-- Comment for documentation
comment on function public.handle_new_user() is 'Automatically creates or updates a profile when a user signs up or updates their metadata';

-- =========================================
-- Helpful indexes for RLS lookups
-- =========================================
create index if not exists idx_board_columns_board on board_columns(board_id);
create index if not exists idx_tasks_board on tasks(board_id);
create index if not exists idx_labels_boardid on labels(board_id);

-- =========================================
-- Grant necessary permissions to authenticated users
-- =========================================
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- Grant permissions on future tables
alter default privileges in schema public grant all on tables to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;

-- =========================================
-- Migration Complete!
-- =========================================
-- Your database is now ready with:
-- ✅ Complete schema (tables, indexes, triggers)
-- ✅ Row Level Security (RLS) policies
-- ✅ Profile creation triggers
-- ✅ All necessary permissions
-- ✅ Ready for Project Sol application
-- =========================================

commit;
