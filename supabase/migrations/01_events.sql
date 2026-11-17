-- PartyAux Supabase Telemetry Schema
-- Only anonymous inserts allowed. No public reads.

create table if not exists public.events (
  id bigint generated always as identity primary key,
  type text not null,
  song_id text not null,
  from_sec numeric(6, 2),
  to_sec numeric(6, 2),
  session uuid not null,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS)
alter table public.events enable row level security;

-- Insert-only policy for anon role (client cannot read or delete events)
create policy "Anon clients can insert events"
  on public.events
  for insert
  to anon
  with check (true);

-- Index for nightly aggregation queries
create index if not exists idx_events_type_created
  on public.events (type, created_at desc);

create index if not exists idx_events_song_id
  on public.events (song_id);
