import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuctionStore } from '../stores/auctionStore';

const POLL_INTERVAL_MS = 8000; // fallback refresh when realtime is not live

/**
 * Mounts Supabase Realtime channels for the live auction room.
 * Feeds events into auctionStore patch handlers.
 * Tracks viewer presence so all clients see a live viewer count.
 * Cleans up all channels on unmount.
 *
 * Returns { isRealtimeLive } — true once all channels confirm SUBSCRIBED.
 * When false, callers should show a "Reconnecting…" indicator and rely on
 * the built-in polling fallback (fires every 8 s).
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
    _refreshBids,
    _setViewerCount,
  } = useAuctionStore();

  const [isRealtimeLive, setIsRealtimeLive] = useState(false);
  // Track how many of our 4 postgres_changes channels have confirmed SUBSCRIBED
  const subscribedCount = useRef(0);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    if (!auctionId) return;
    subscribedCount.current = 0;
    setIsRealtimeLive(false);
    loadAuction(auctionId);

    function startPolling() {
      if (pollTimerRef.current) return;
      pollTimerRef.current = setInterval(() => loadAuction(auctionId, true), POLL_INTERVAL_MS);
    }

    function stopPolling() {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    function onChannelStatus(status) {
      if (status === 'SUBSCRIBED') {
        subscribedCount.current += 1;
        // All 4 channels confirmed — realtime is live, stop polling
        if (subscribedCount.current >= 4) {
          setIsRealtimeLive(true);
          stopPolling();
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        // Realtime degraded — restart polling as fallback
        setIsRealtimeLive(false);
        startPolling();
      }
    }

    // Poll until all 4 realtime channels confirm SUBSCRIBED; stops automatically once live.
    // Bids are kept fresh via _refreshBids() in the players channel handler (no polling needed for bids).
    startPolling();

    const metaChannel = supabase
      .channel(`auction:${auctionId}:meta`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}`,
      }, (payload) => _onAuctionUpdate(payload.new))
      .subscribe(onChannelStatus);

    const playersChannel = supabase
      .channel(`auction:${auctionId}:players`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'auction_players', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => {
        _patchPlayer(payload.new);
        // Whenever the active player's bid changes, refresh the full bid log from DB
        // so all viewers (not just the auctioneer who calls refreshBids locally) stay in sync.
        // This is the primary fallback for auction_bids realtime not delivering to all clients.
        if (payload.new.status === 'active' && payload.new.current_bid != null) {
          _refreshBids(payload.new.id);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'auction_players', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => _patchPlayer(payload.new))
      .subscribe(onChannelStatus);

    const bidsChannel = supabase
      .channel(`auction:${auctionId}:bids`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'auction_bids', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => _appendBid(payload.new))
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'auction_bids', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => _removeBid(payload.old?.id))
      .subscribe(onChannelStatus);

    const teamsChannel = supabase
      .channel(`auction:${auctionId}:teams`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'auction_teams', filter: `auction_id=eq.${auctionId}`,
      }, (payload) => _patchTeam(payload.new))
      .subscribe(onChannelStatus);

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
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      supabase.removeChannel(metaChannel);
      supabase.removeChannel(playersChannel);
      supabase.removeChannel(bidsChannel);
      supabase.removeChannel(teamsChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [auctionId]);

  return { isRealtimeLive };
}
