-- Add guest flag to teams
ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_guest boolean DEFAULT false;

-- Team default roster
CREATE TABLE IF NOT EXISTS team_players (
  team_id   uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, player_id)
);

ALTER TABLE team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_players_select" ON team_players
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "team_players_insert" ON team_players
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('admin','scorer'))
  );

CREATE POLICY "team_players_delete" ON team_players
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('admin','scorer'))
  );
