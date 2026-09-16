-- Photo Storage bucket (run in Supabase Dashboard → Storage → New Bucket)
-- Name: etie-photos
-- Public: false (signed URLs)
-- File size limit: 5MB
-- Allowed MIME types: image/*

-- RLS for storage.objects (etie-photos bucket)
-- Users can upload to their own folder: user_id/*
-- Users can read their own photos and photos of matched users

-- Policy: users can upload to their own folder
create policy "users_upload_own_photos" on storage.objects
for insert with check (
  bucket_id = 'etie-photos' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: users can read their own photos
create policy "users_read_own_photos" on storage.objects
for select using (
  bucket_id = 'etie-photos' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: users can read photos of users they have a match with
-- (requires a function to check match, simplified for now)
create policy "matched_users_read_photos" on storage.objects
for select using (
  bucket_id = 'etie-photos' and
  exists (
    select 1 from public.etie_requests r
    where r.id::text = (storage.foldername(name))[1]
    and (r.traveller_id = auth.uid() or r.local_id = auth.uid())
    and r.status = 'accepted'
  )
);