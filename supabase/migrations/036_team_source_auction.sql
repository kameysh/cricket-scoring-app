-- Link global teams back to the auction they were created from
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS source_auction_id uuid REFERENCES auctions(id) ON DELETE SET NULL;
