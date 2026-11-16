create table if not exists content_runs (
  id text primary key,
  local_date date not null,
  mode text not null check (mode in ('test','scheduled')),
  next_stage int not null default 1 check (next_stage between 1 and 6),
  revision int not null default 1 check (revision between 1 and 3),
  status text not null default 'queued' check (status in ('queued','running','blocked','review','approved')),
  stages jsonb not null default '{}',
  corrections jsonb not null default '[]',
  events jsonb not null default '[]',
  error text,
  lease_id uuid,
  lease_until timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists content_one_daily_run
  on content_runs (local_date) where mode = 'scheduled';
