import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuctionStore } from '../stores/auctionStore';

/**
 * Mounts 4 Supabase Realtime channels for the live auction room.
 * Feeds events into auctionStore patch handlers.
 * Cleans up all channels on unmount.
 *
 * Replication must be enabled in Supabase Dashboard for:
 *   auctions, auction_teams, auction_players, auction_bids
 */
export function useAuctionRoom(auctionId) {
  const { loadAuction, _onAuctionUpdate, _patchPlayer, _appendBid, _patchTeam } = useAuctionStore();

  useEffect(() => {
    if (!auctionId) return;
    loadAuction(auctionId);

    const metaChannel = supabase
      .channel(`auction:${auctionId}:meta`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}`,
      }, (payload) => _onAuctionUpdate(payload.new))
      .subscribe();

    const playersChannel = supabase
      .channel(`auction:${auctionId}:players`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'auction_players', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => _patchPlayer(payload.new))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'auction_players', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => _patchPlayer(payload.new))
      .subscribe();

    const bidsChannel = supabase
      .channel(`auction:${auctionId}:bids`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'auction_bids', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => _appendBid(payload.new))
      .subscribe();

    const teamsChannel = supabase
      .channel(`auction:${auctionId}:teams`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'auction_teams', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => _patchTeam(payload.new))
      .subscribe();

    return () => {
      supabase.removeChannel(metaChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(teamsChannel);
    };
  }, [auctionId]);
}
