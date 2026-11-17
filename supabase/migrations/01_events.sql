-- Telemetry events. Anonymous clients may INSERT only.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  type text not null,
  song_id text,
  from_sec real,
  to_sec real,
  session text,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

-- Insert-only policy for anon role restricted by allowed event types and seconds range (Doc 04 section 5)
create policy "anon can insert events"
  on public.events
  for insert
  to anon
  with check (
    type in ('live','seek','skip','cut','playfull','paused','resumed','holding','unavailable','finished')
    and (from_sec is null or (from_sec >= 0 and from_sec < 20000))
    and (to_sec   is null or (to_sec   >= 0 and to_sec   < 20000))
  );

create index if not exists events_song_type_idx on public.events (song_id, type, created_at desc);
