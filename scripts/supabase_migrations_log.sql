-- Supabase Migrations Log

-- Migration: create_user_profiles_table
-- Applied on: 2025-05-23 (Placeholder, actual timestamp from Supabase migrations table if needed)

-- Create a table for public profiles
create table profiles (
  id uuid references auth.users not null primary key,
  email text unique,
  full_name text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security
alter table profiles
  enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- End Migration: create_user_profiles_table

----------------------------------------------------------------------------------------------------

-- Migration: create_prompt_repositories_table
-- Applied on: 2025-05-23 (Placeholder, actual timestamp from Supabase migrations table if needed)

-- Create a table for prompt repositories
create table prompt_repositories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) not null,
  name text not null,
  description text,
  is_public boolean default true not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Add other metadata columns as needed, e.g., tags, model_compatibility
  tags text[],
  model_compatibility text[]
);

-- Add indexes
create index idx_prompt_repositories_user_id on prompt_repositories(user_id);
create index idx_prompt_repositories_is_public on prompt_repositories(is_public);

-- Set up Row Level Security (RLS)
alter table prompt_repositories
  enable row level security;

create policy "Users can view public repositories." on prompt_repositories
  for select using (is_public = true);

create policy "Users can view their own repositories." on prompt_repositories
  for select using (auth.uid() = user_id);

create policy "Users can insert their own repositories." on prompt_repositories
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own repositories." on prompt_repositories
  for update using (auth.uid() = user_id);

create policy "Users can delete their own repositories." on prompt_repositories
  for delete using (auth.uid() = user_id);

-- End Migration: create_prompt_repositories_table
----------------------------------------------------------------------------------------------------

-- Migration: create_prompt_versions_table
-- Applied on: 2025-05-23 (Placeholder, actual timestamp from Supabase migrations table if needed)

-- Create a table for prompt versions
create table prompt_versions (
  id uuid default gen_random_uuid() primary key,
  repository_id uuid references prompt_repositories(id) on delete cascade not null,
  version_number integer not null default 1,
  prompt_text text not null,
  variables jsonb, -- For storing key-value pairs of variables used in the prompt
  model_settings jsonb, -- For storing model parameters like temperature, max_tokens, etc.
  notes text, -- User notes for this specific version
  created_at timestamptz default now(),
  user_id uuid references profiles(id) not null, -- User who created this version

  unique (repository_id, version_number) -- Ensure version numbers are unique per repository
);

-- Add indexes
create index idx_prompt_versions_repository_id on prompt_versions(repository_id);
create index idx_prompt_versions_user_id on prompt_versions(user_id);

-- Set up Row Level Security (RLS)
alter table prompt_versions
  enable row level security;

-- Users can view versions of public repositories
create policy "Users can view versions of public repositories." on prompt_versions
  for select using (
    exists (
      select 1 from prompt_repositories pr
      where pr.id = prompt_versions.repository_id and pr.is_public = true
    )
  );

-- Users can view versions of their own repositories
create policy "Users can view versions of their own repositories." on prompt_versions
  for select using (
    exists (
      select 1 from prompt_repositories pr
      where pr.id = prompt_versions.repository_id and pr.user_id = auth.uid()
    )
  );

-- Users can insert versions for their own repositories
create policy "Users can insert versions for their own repositories." on prompt_versions
  for insert with check (
    auth.uid() = user_id and
    exists (
      select 1 from prompt_repositories pr
      where pr.id = prompt_versions.repository_id and pr.user_id = auth.uid()
    )
  );

-- Users can update versions they created for their own repositories
create policy "Users can update versions they created." on prompt_versions
  for update using (
    auth.uid() = user_id and
    exists (
      select 1 from prompt_repositories pr
      where pr.id = prompt_versions.repository_id and pr.user_id = auth.uid()
    )
  );

-- Users can delete versions they created for their own repositories
create policy "Users can delete versions they created." on prompt_versions
  for delete using (
    auth.uid() = user_id and
    exists (
      select 1 from prompt_repositories pr
      where pr.id = prompt_versions.repository_id and pr.user_id = auth.uid()
    )
  );

-- End Migration: create_prompt_versions_table