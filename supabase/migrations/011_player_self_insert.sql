-- Allow users with the 'player' role to create their own player profile.
-- Migration 003 restricted players INSERT to admin/captain only, blocking invited players
-- from setting up their profile after accepting an invite.

create policy "player_insert_own_profile" on players
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from app_users where id = auth.uid() and role = 'player')
  );
