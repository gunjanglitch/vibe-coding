# 🎮 Name Place Animal Thing

The classic nostalgic notebook game — now multiplayer in real time!

## Setup Instructions

### 1. Supabase Setup (Free)
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to SQL Editor and run this schema:

```sql
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

-- Enable realtime
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table answers;
```

4. Go to Settings → API and copy your **Project URL** and **anon public key**

### 2. Daily.co Setup (Voice Chat - Free)
1. Go to [daily.co](https://daily.co) and create a free account
2. Create a room (you can name it anything, rooms are auto-created per game session)
3. The free tier gives 10,000 minutes/month — more than enough for friend groups!

### 3. Environment Variables
Create a `.env` file in the project root:

```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Install & Run

```bash
npm install
npm start
```

### 5. Deploy (Free)
Deploy to [Vercel](https://vercel.com) or [Netlify](https://netlify.com) for free hosting!

---

## How to Play

1. **Create a Room** — Enter your name, create a room, share the 6-letter code with friends
2. **Lobby** — Host sets number of rounds and any custom columns, then starts the game
3. **Letter Phase** — The Sayer sees letters cycling (A→Z), the Stopper hits STOP!
4. **Answer Phase** — Everyone fills in Name, Place, Animal, Thing with that letter
5. **First to finish** hits Done → 30 second countdown starts for everyone
6. **Scoring** — Unique answer = 10pts, Common = 5pts, First done = +5 bonus
7. **After each round** — Scoreboard shows standings with a fun roast line 😄

---

## Tech Stack
- **React** — Frontend
- **Supabase** — Real-time game sync (open source, free)
- **Daily.co** — Voice chat (free tier)
