-- Drop the old innings_number check constraint (only allowed 1,2,3)
-- Super over innings need numbers 3,4 and successive SOs need 5,6…
alter table innings drop constraint if exists innings_innings_number_check;

-- Replace with a simple positive-integer check
alter table innings add constraint innings_innings_number_check check (innings_number >= 1);
