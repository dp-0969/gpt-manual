-- Run this in Supabase SQL Editor

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  role text,
  location text,
  hours text,
  communication text,
  interests text,
  image_url text,
  custom_fields jsonb default '[]'::jsonb,
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_email text
);

alter table public.profiles enable row level security;

-- Everyone signed in can view team profiles
create policy "Profiles are viewable by signed-in users"
on public.profiles for select
to authenticated
using (true);

-- Users can create their own profile rows
create policy "Users can create their own profiles"
on public.profiles for insert
to authenticated
with check (auth.uid() = owner_id);

-- Only the profile creator can edit
create policy "Users can update their own profiles"
on public.profiles for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

-- Only the profile creator can delete
create policy "Users can delete their own profiles"
on public.profiles for delete
to authenticated
using (auth.uid() = owner_id);

-- Storage bucket for profile pictures
insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

-- Signed-in users can upload images into their own folder
create policy "Users can upload own profile images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- Everyone signed in can view images
create policy "Profile images are viewable by signed-in users"
on storage.objects for select
to authenticated
using (bucket_id = 'profile-images');

-- Users can update/delete their own uploaded images
create policy "Users can update own profile images"
on storage.objects for update
to authenticated
using (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own profile images"
on storage.objects for delete
to authenticated
using (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);
