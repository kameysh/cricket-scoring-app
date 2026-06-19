-- Storage RLS policies for player-photos bucket
-- Allows authenticated users to upload and update player photos

create policy "Auth users can upload player photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos');

create policy "Auth users can update player photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'player-photos');

create policy "Public read player photos"
  on storage.objects for select to public
  using (bucket_id = 'player-photos');

-- Allow the player role to update their own player record (for saving photo_url)
create policy "Players can update own record"
  on players for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
