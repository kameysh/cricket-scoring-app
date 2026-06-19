-- Add wicket keeper designation per team per match (optional, default false)
alter table match_players
  add column if not exists is_keeper boolean not null default false;
