-- 025_sub_linkage.sql
-- Links each substitute row to the match_players row they replaced.
-- Allows correct swap-back even when multiple swaps happen in one match.
alter table match_players
  add column if not exists subbed_out_player_id uuid references match_players(id);
