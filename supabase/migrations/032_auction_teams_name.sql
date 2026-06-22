-- Auction teams should be standalone bidding entities, not tied to the global teams registry.
-- Add a direct name column and make team_id nullable for backward compatibility.

alter table auction_teams
  add column if not exists name text;

-- Make team_id nullable so auction teams don't need a global teams entry
alter table auction_teams
  alter column team_id drop not null;

-- Backfill name from the teams join for any existing rows
update auction_teams at
set name = t.name
from teams t
where t.id = at.team_id
  and at.name is null;
