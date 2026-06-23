-- Allow admins to delete bids (needed for Undo Last Bid feature).
-- Without this, RLS silently blocks the DELETE returning no error and no rows
-- deleted, causing phantom bids to accumulate and undo to misbehave.
create policy "auction_bids_delete" on auction_bids
  for delete to authenticated
  using (
    exists (select 1 from app_users where id = auth.uid() and role = 'admin')
  );
