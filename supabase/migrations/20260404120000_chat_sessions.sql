-- 每用户一行：对话进度快照（JSON），供换设备登录后恢复
-- 在 Supabase Dashboard → SQL Editor 中执行本文件，或使用 supabase db push

create table if not exists public.chat_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_updated_at_idx on public.chat_sessions (updated_at desc);

alter table public.chat_sessions enable row level security;

create policy "Users select own chat_sessions"
  on public.chat_sessions for select
  using (auth.uid() = user_id);

create policy "Users insert own chat_sessions"
  on public.chat_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users update own chat_sessions"
  on public.chat_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own chat_sessions"
  on public.chat_sessions for delete
  using (auth.uid() = user_id);

comment on table public.chat_sessions is 'LifeECHO chat progress; synced from frontend for cross-device restore';
