-- 033_auction_bid_type_autosell.sql
-- Extend bid_type check constraint to allow 'captain_autosell'
-- (inserted by autosellCaptains() when the auction goes live)

alter table auction_bids
  drop constraint if exists auction_bids_bid_type_check;

alter table auction_bids
  add constraint auction_bids_bid_type_check
    check (bid_type in ('captain', 'auctioneer_raise', 'captain_autosell'));
