import { createClient } from '@supabase/supabase-js';

// Users will need to add their own Supabase credentials
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/*
 SUPABASE SQL SCHEMA — run this in your Supabase SQL editor:

create table rooms (
  id text primary key,
  name text,
  host_id text,
  status text default 'lobby',
  total_rounds int default 5,
  current_round int default 0,
  current_letter text,
  custom_columns jsonb default '[]',
  sayer_index int default 0,
  stopper_index int default 1,
  created_at timestamp default now()
);

create table players (
  id text primary key,
  room_id text references rooms(id),
  name text,
  score int default 0,
  is_ready boolean default false,
  is_done boolean default false,
  joined_at timestamp default now()
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  room_id text,
  player_id text,
  round int,
  letter text,
  answers jsonb,
  marks jsonb,
  total_marks int default 0,
  finished_first boolean default false,
  submitted_at timestamp default now()
);

-- Enable realtime for all tables
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table answers;
*/
