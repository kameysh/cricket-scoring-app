-- Mark innings that are part of a super over
alter table innings add column if not exists is_super_over boolean default false;
