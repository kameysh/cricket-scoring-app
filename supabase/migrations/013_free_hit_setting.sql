-- Add optional free hit setting per match (default off for gully cricket)
alter table matches add column if not exists free_hit_on_no_ball boolean default false;
