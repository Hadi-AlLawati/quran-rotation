-- Create profiles table
create table public.profiles (
  id uuid references auth.users not null primary key,
  name text not null check (char_length(name) > 0 and char_length(name) <= 50),
  role text default 'user'::text check (role in ('admin', 'user')),
  group_id integer,
  half text check (half in ('first', 'second', 'full')),
  start_juz integer not null check (start_juz between 1 and 30),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  points integer default 0,
  penalty integer default 0
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Everyone can read profiles (needed for the Leaderboard and overview)
create policy "Public profiles are viewable by everyone." on public.profiles
  for select using (true);

-- Users can insert their own profile during Sign Up, defaulting to 'user' role
create policy "Users can insert their own profile." on public.profiles
  for insert with check (auth.uid() = id and role = 'user');

-- Users can update their own profile, but cannot elevate themselves to admin
create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- Admins can update all profiles (for override feature)
create policy "Admins can update all profiles." on public.profiles
  for update using ( (select role from public.profiles where id = auth.uid()) = 'admin' );

-- Create reading history table
create table public.reading_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  week_number integer not null,
  juz_completed integer not null,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.reading_history enable row level security;

-- Everyone can view history
create policy "History is viewable by everyone." on public.reading_history
  for select using (true);

-- Users can insert their own history when they finish reading
create policy "Users can insert their own history." on public.reading_history
  for insert with check (auth.uid() = user_id);
