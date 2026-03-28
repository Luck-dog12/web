create extension if not exists pgcrypto;

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price_usd numeric(10,2) not null check (price_usd > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  cf_stream_video_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete restrict,
  amount_usd numeric(10,2) not null check (amount_usd > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'pending' check (status in ('pending', 'captured', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  paypal_order_id text not null unique,
  paypal_capture_id text unique,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create table if not exists public.paypal_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  resource_json jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);

create index if not exists idx_videos_status_created_at on public.videos(status, created_at desc);
create index if not exists idx_orders_user_created_at on public.orders(user_id, created_at desc);
create index if not exists idx_orders_video_created_at on public.orders(video_id, created_at desc);
create index if not exists idx_entitlements_user_status on public.entitlements(user_id, status);
create index if not exists idx_entitlements_video_status on public.entitlements(video_id, status);

alter table public.videos enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.entitlements enable row level security;
alter table public.paypal_webhook_events enable row level security;

drop policy if exists "videos_published_read" on public.videos;
create policy "videos_published_read"
on public.videos
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "orders_owner_read" on public.orders;
create policy "orders_owner_read"
on public.orders
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "payments_owner_read" on public.payments;
create policy "payments_owner_read"
on public.payments
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = payments.order_id and o.user_id = auth.uid()
  )
);

drop policy if exists "entitlements_owner_read" on public.entitlements;
create policy "entitlements_owner_read"
on public.entitlements
for select
to authenticated
using (user_id = auth.uid());
