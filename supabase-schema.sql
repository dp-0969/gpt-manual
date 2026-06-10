-- Team Manual Supabase schema
-- Only use this if setting up from scratch. If your table already exists, add missing columns instead.

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
  created_by uuid references auth.users(id) on delete cascade,
  owner_email text
);

alter table public.profiles enable row level security;

create policy "Public can view profiles"
on public.profiles for select
to anon, authenticated
using (true);

create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = created_by);

create policy "Users can edit their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

create policy "Users can delete their own profile"
on public.profiles for delete
to authenticated
using (auth.uid() = created_by);

insert into storage.buckets (id, name, public)
values ('profile-images', 'profile-images', true)
on conflict (id) do nothing;

create policy "Public can view profile images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'profile-images');

create policy "Users can upload own profile images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own profile images"
on storage.objects for update
to authenticated
using (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own profile images"
on storage.objects for delete
to authenticated
using (bucket_id = 'profile-images' and auth.uid()::text = (storage.foldername(name))[1]);
