-- Allow a player-role user to claim an unclaimed player row (user_id IS NULL)
-- by setting user_id = auth.uid() on it. This prevents duplicates when an admin
-- pre-creates a player before the user accepts their invite.
CREATE POLICY "players_claim_own" ON players FOR UPDATE TO authenticated
  USING (
    user_id IS NULL
    AND exists (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'player')
  )
  WITH CHECK (
    user_id = auth.uid()
  );
