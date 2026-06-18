alter table tournaments
  add column if not exists series_matches int check (series_matches in (3, 5));
