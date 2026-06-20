-- Add matches_played counter to player_career_stats.
-- This tracks squad participation (match_players rows), not just matches where a player batted.
-- Incremented atomically via RPC when a match is marked completed.

ALTER TABLE player_career_stats
  ADD COLUMN IF NOT EXISTS matches_played int not null default 0;

-- RPC: increment matches_played for every squad member of a completed match.
-- Called from matchService.incrementMatchesPlayed() after match status → completed.
CREATE OR REPLACE FUNCTION increment_matches_played(p_match_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO player_career_stats (player_id, matches_played)
  SELECT player_id, 1
  FROM match_players
  WHERE match_id = p_match_id
  ON CONFLICT (player_id) DO UPDATE
    SET matches_played = player_career_stats.matches_played + 1,
        updated_at     = now();
END;
$$;

-- Backfill existing completed matches so historical data is correct.
INSERT INTO player_career_stats (player_id, matches_played)
SELECT mp.player_id, COUNT(DISTINCT mp.match_id)::int
FROM match_players mp
JOIN matches m ON m.id = mp.match_id
WHERE m.status = 'completed'
GROUP BY mp.player_id
ON CONFLICT (player_id) DO UPDATE
  SET matches_played = EXCLUDED.matches_played;
