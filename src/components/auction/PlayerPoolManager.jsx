import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import * as playerService from '../../services/playerService';
import * as auctionService from '../../services/auctionService';
import PlayerAvatar from '../player/PlayerAvatar';
import toast from 'react-hot-toast';

export default function PlayerPoolManager({ auctionId, poolPlayers, captainUserIds = [], onPoolChange }) {
  const [allPlayers, setAllPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [basePrices, setBasePrices] = useState({});

  useEffect(() => {
    playerService.listPlayers({ activeOnly: true }).then(setAllPlayers).catch(() => {});
  }, []);

  const poolIds = new Set(poolPlayers.map(p => p.player_id));
  const captainUserIdSet = new Set(captainUserIds);

  // Separate captains from regular players so they don't appear in the bidding pool
  const captainPlayers = allPlayers.filter(p => p.user_id && captainUserIdSet.has(p.user_id));
  const captainPlayerIds = new Set(captainPlayers.map(p => p.id));

  const filtered = allPlayers.filter(p =>
    !captainPlayerIds.has(p.id) &&
    (!search || p.name?.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleToggle(player) {
    if (poolIds.has(player.id)) {
      // Remove
      const row = poolPlayers.find(p => p.player_id === player.id);
      if (!row) return;
      try {
        await auctionService.removePlayerFromPool(row.id);
        onPoolChange();
      } catch (e) {
        toast.error(e.message);
      }
    } else {
      // Add
      setLoading(true);
      try {
        const basePrice = basePrices[player.id] ?? 100;
        await auctionService.addPlayerToPool(auctionId, player.id, basePrice);
        onPoolChange();
      } catch (e) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">
          Player Pool <span className="text-brand-green">({poolPlayers.filter(p => !captainPlayerIds.has(p.player_id)).length} in pool)</span>
        </p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search players…"
          className="w-full pl-8 pr-3 py-2 rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        />
      </div>

      {/* Captains — auto-assigned at start, not available for bidding */}
      {captainPlayers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">
            Captains — auto-assigned at auction start
          </p>
          {captainPlayers.map(player => (
            <div key={player.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 opacity-75">
              <PlayerAvatar player={player} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{player.name}</p>
                <p className="text-[11px] text-ink-400">{player.role}</p>
              </div>
              <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">👑 Captain</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {filtered.map(player => {
          const inPool = poolIds.has(player.id);
          return (
            <div key={player.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors cursor-pointer ${inPool ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20' : 'bg-ink-50 dark:bg-white/5 hover:bg-ink-100 dark:hover:bg-white/10'}`}
              onClick={() => handleToggle(player)}
            >
              <PlayerAvatar player={player} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{player.name}</p>
                <p className="text-[11px] text-ink-400">{player.role}</p>
              </div>
              {inPool ? (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="number"
                    min={0}
                    value={poolPlayers.find(p => p.player_id === player.id)?.base_price ?? 100}
                    onChange={async e => {
                      const row = poolPlayers.find(p => p.player_id === player.id);
                      if (!row) return;
                      try {
                        await auctionService.updatePlayerBasePrice(row.id, Number(e.target.value));
                        onPoolChange();
                      } catch {}
                    }}
                    className="w-20 px-2 py-1 text-xs rounded-lg border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 text-right tabular-nums"
                  />
                  <span className="text-xs text-green-600 font-bold">✓</span>
                </div>
              ) : (
                <span className="text-xs text-ink-300">+ Add</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
