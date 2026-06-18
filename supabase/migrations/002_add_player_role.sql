-- Add role field to players table
alter table players add column if not exists role text;

-- Valid values: 'batsman', 'bowler', 'allrounder', 'wicket_keeper'
