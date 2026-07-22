-- ============================================================
-- FARM OFF — Supabase スキーマ
-- Supabaseダッシュボード > SQL Editor に貼り付けて実行してください
-- ============================================================

-- 1. ユーザー種別を持つプロフィールテーブル
--    Supabaseの認証（auth.users）に紐づけて、
--    「農家」か「代理管理者」かを区別します
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('farmer', 'agent')),
  display_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- 2. 農園（農家が登録する管理対象の場所）
create table farms (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references profiles(id) on delete cascade,
  name text not null,               -- 例: 和田農園（ハウスA）
  created_at timestamptz not null default now()
);

-- 3. 農園と代理管理者の割り当て（誰がどの農園を担当するか）
create table farm_agents (
  farm_id uuid not null references farms(id) on delete cascade,
  agent_id uuid not null references profiles(id) on delete cascade,
  primary key (farm_id, agent_id)
);

-- 4. schedules — 訪問予定
create table schedules (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  agent_id uuid references profiles(id),
  visit_date date not null,
  visit_time time,
  task text not null,
  created_at timestamptz not null default now()
);

-- 5. reports — 訪問後の報告
create table reports (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  agent_id uuid not null references profiles(id),
  note text not null,
  is_ok boolean not null default true,
  photo_url text,                   -- Supabase Storageの公開URL
  created_at timestamptz not null default now()
);

-- 6. messages — 農家⇄代理管理者のチャット
create table messages (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- 7. manuals — 農園ごとの作業マニュアル
create table manuals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references farms(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 行レベルセキュリティ（RLS）
-- 「自分の農園に関係する人だけが読み書きできる」を徹底します
-- ============================================================

alter table profiles enable row level security;
alter table farms enable row level security;
alter table farm_agents enable row level security;
alter table schedules enable row level security;
alter table reports enable row level security;
alter table messages enable row level security;
alter table manuals enable row level security;

-- 自分のプロフィールは自分で見れる・作れる
create policy "own profile read" on profiles for select using (auth.uid() = id);
create policy "own profile insert" on profiles for insert with check (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id);

-- 農園に関係する人（農家本人 or 割り当てられた代行者）だけがアクセス可能、という判定を
-- 何度も使うので、関数にまとめておきます
create or replace function is_related_to_farm(target_farm_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from farms f
    where f.id = target_farm_id and f.farmer_id = auth.uid()
  ) or exists (
    select 1 from farm_agents fa
    where fa.farm_id = target_farm_id and fa.agent_id = auth.uid()
  );
$$;

create policy "farms: related can read" on farms for select using (is_related_to_farm(id));
create policy "farms: farmer can insert" on farms for insert with check (farmer_id = auth.uid());
create policy "farms: farmer can update" on farms for update using (farmer_id = auth.uid());

create policy "farm_agents: related can read" on farm_agents for select using (is_related_to_farm(farm_id));

create policy "schedules: related can read" on schedules for select using (is_related_to_farm(farm_id));
create policy "schedules: related can write" on schedules for insert with check (is_related_to_farm(farm_id));
create policy "schedules: related can update" on schedules for update using (is_related_to_farm(farm_id));
create policy "schedules: related can delete" on schedules for delete using (is_related_to_farm(farm_id));

create policy "reports: related can read" on reports for select using (is_related_to_farm(farm_id));
create policy "reports: agent can insert" on reports for insert with check (is_related_to_farm(farm_id) and agent_id = auth.uid());

create policy "messages: related can read" on messages for select using (is_related_to_farm(farm_id));
create policy "messages: related can insert" on messages for insert with check (is_related_to_farm(farm_id) and sender_id = auth.uid());

create policy "manuals: related can read" on manuals for select using (is_related_to_farm(farm_id));
create policy "manuals: related can write" on manuals for insert with check (is_related_to_farm(farm_id));
create policy "manuals: related can update" on manuals for update using (is_related_to_farm(farm_id));
create policy "manuals: related can delete" on manuals for delete using (is_related_to_farm(farm_id));

-- ============================================================
-- Storage: 訪問報告の写真用バケット
-- SQL Editorではなく「Storage」タブから作成してもOKです
-- ============================================================
insert into storage.buckets (id, name, public) values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;

create policy "report-photos: anyone signed in can upload"
on storage.objects for insert
with check (bucket_id = 'report-photos' and auth.role() = 'authenticated');

create policy "report-photos: public can view"
on storage.objects for select
using (bucket_id = 'report-photos');
