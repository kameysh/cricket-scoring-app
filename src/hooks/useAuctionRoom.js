import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuctionStore } from '../stores/auctionStore';

/**
 * Mounts Supabase Realtime channels for the live auction room.
 * Feeds events into auctionStore patch handlers.
 * Tracks viewer presence so all clients see a live viewer count.
 * Cleans up all channels on unmount.
 *
 * Replication must be enabled in Supabase Dashboard for:
 *   auctions, auction_teams, auction_players, auction_bids
 */
export function useAuctionRoom(auctionId, userId) {
  const {
    loadAuction,
    _onAuctionUpdate,
    _patchPlayer,
    _appendBid,
    _removeBid,
    _patchTeam,
    _setViewerCount,
  } = useAuctionStore();

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
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'auction_bids', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => _removeBid(payload.old?.id))
      .subscribe();

    const teamsChannel = supabase
      .channel(`auction:${auctionId}:teams`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'auction_teams', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => _patchTeam(payload.new))
      .subscribe();

    // Presence channel — tracks who is watching for live viewer count
    const presenceChannel = supabase
      .channel(`auction:${auctionId}:presence`, { config: { presence: { key: userId ?? 'anon' } } })
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        _setViewerCount(Object.keys(state).length);
      })
      .on('presence', { event: 'join' }, () => {
        const state = presenceChannel.presenceState();
        _setViewerCount(Object.keys(state).length);
      })
      .on('presence', { event: 'leave' }, () => {
        const state = presenceChannel.presenceState();
        _setViewerCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ uid: userId ?? 'anon', joinedAt: Date.now() });
        }
      });

    return () => {
      supabase.removeChannel(metaChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [auctionId]);
}
