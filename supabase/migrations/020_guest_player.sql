-- Guest flag for players added without an account (unknown team members, walk-ins etc.)
-- When an admin later invites the person and links their user_id, is_guest is cleared.
ALTER TABLE players ADD COLUMN IF NOT EXISTS is_guest boolean DEFAULT false;
