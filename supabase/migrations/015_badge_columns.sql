-- Add hat-trick counter to career stats for badge tracking
alter table player_career_stats
  add column if not exists bowl_hat_tricks int not null default 0;
