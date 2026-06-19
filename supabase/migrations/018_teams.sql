-- Global teams registry: allows admins to pre-register team names
-- that auto-populate in match and tournament setup dropdowns.
-- NOTE: This migration was run manually in Supabase with the policy below.

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT teams_name_unique UNIQUE (name)
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Everyone can read teams
CREATE POLICY "teams_read_all" ON teams FOR SELECT USING (true);

-- Admins and scorers can insert
CREATE POLICY "teams_insert_admin_scorer" ON teams FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role IN ('admin', 'scorer'))
  );

-- Admins only can delete
CREATE POLICY "teams_delete_admin" ON teams FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'admin')
  );
