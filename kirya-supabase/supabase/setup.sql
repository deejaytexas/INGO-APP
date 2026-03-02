-- ═══════════════════════════════════════════════════════════════════════════
-- Kirya Delivery — Supabase Setup
-- Paste this entire file into: Supabase Dashboard → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Riders table ─────────────────────────────────────────────────────────
create table if not exists public.riders (
  id          text primary key,            -- e.g. 'rider_1'
  name        text not null,
  lat         double precision not null default 1.0821,
  lng         double precision not null default 34.1750,
  status      text not null default 'offline',   -- online | offline | busy
  task_status text not null default 'idle',       -- idle | to_shop | at_shop | to_delivery | delivered
  last_seen   timestamptz not null default now()
);

-- ─── 2. Orders table ─────────────────────────────────────────────────────────
create table if not exists public.orders (
  id                  text primary key,
  customer_id         text not null,
  rider_id            text references public.riders(id),
  items               jsonb not null default '[]',
  delivery_location   jsonb not null,             -- { lat, lng, address }
  status              text not null default 'pending',
  -- pending | assigned | to_shop | at_shop | to_delivery | delivered
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── 3. Chat messages table ───────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id          bigserial primary key,
  order_id    text not null references public.orders(id),
  role        text not null,              -- 'rider' | 'user'
  text        text not null,
  created_at  timestamptz not null default now()
);

-- ─── 4. Enable Realtime on all three tables ──────────────────────────────────
-- This lets any INSERT/UPDATE/DELETE trigger live events to subscribed clients.
alter publication supabase_realtime add table public.riders;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.chat_messages;

-- ─── 5. Row Level Security ───────────────────────────────────────────────────
-- For demo/dev: allow all operations from the anon key.
-- Tighten these when you add authentication.

alter table public.riders enable row level security;
alter table public.orders enable row level security;
alter table public.chat_messages enable row level security;

create policy "public read riders"  on public.riders         for select using (true);
create policy "public write riders" on public.riders         for all    using (true);
create policy "public read orders"  on public.orders         for select using (true);
create policy "public write orders" on public.orders         for all    using (true);
create policy "public read chat"    on public.chat_messages  for select using (true);
create policy "public write chat"   on public.chat_messages  for all    using (true);

-- ─── 6. Auto-update updated_at on orders ─────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Done! ✅
-- Your Supabase project is ready. Go back to the app and fill in .env with:
--   VITE_SUPABASE_URL  = Project URL  (Settings → API)
--   VITE_SUPABASE_ANON_KEY = anon/public key (Settings → API)
