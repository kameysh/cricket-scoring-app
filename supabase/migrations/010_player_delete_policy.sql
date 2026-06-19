-- Add DELETE policy for players table
-- Migration 003 replaced allow_all_players but never added a DELETE policy,
-- causing all deletes to silently no-op (RLS blocks with no error).

create policy "admin_delete_players" on players
  for delete using (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );
