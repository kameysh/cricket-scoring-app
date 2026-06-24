import { useState, useEffect, useRef } from 'react';
import { Search, Trash2, Check } from 'lucide-react';
import * as playerService from '../../services/playerService';
import * as auctionService from '../../services/auctionService';
import PlayerAvatar from '../player/PlayerAvatar';
import PlayerName from '../shared/PlayerName';
import toast from 'react-hot-toast';

// Inline base-price editor — local state, saves only on blur/Enter.
// Pass `row` for an existing pool entry (updates via updatePlayerBasePrice),
// or `onCreate(price)` for a captain not yet in the pool (adds them first).
function PriceCell({ row, onCreate, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row?.base_price ?? 100));
  const inputRef = useRef(null);

  function startEdit() {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commit() {
    const num = Math.max(0, Number(value) || 0);
    setValue(String(num));
    setEditing(false);
    try {
      if (row) {
        if (num === (row.base_price ?? 100)) return; // no change
        await auctionService.updatePlayerBasePrice(row.id, num);
      } else {
        await onCreate(num);
      }
      onSaved();
    } catch {
      toast.error('Could not update price');
    }
  }

  function onKey(e) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') { setValue(String(row.base_price ?? 100)); setEditing(false); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <span className="text-xs text-ink-400">₹</span>
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          className="w-20 px-2 py-1 text-sm font-semibold rounded-lg border-2 border-brand-green bg-white dark:bg-ink-800 text-right tabular-nums focus:outline-none"
        />
      </div>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); startEdit(); }}
      className="flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-ink-100 dark:bg-white/10 hover:bg-brand-green/10 hover:text-brand-green transition-colors group"
      title="Tap to edit base price"
    >
      <span className="text-[11px] text-ink-400 group-hover:text-brand-green">₹</span>
      <span className="text-sm font-bold tabular-nums text-ink-700 dark:text-ink-200 group-hover:text-brand-green">
        {(row?.base_price ?? 100).toLocaleString()}
      </span>
    </button>
  );
}

export default function PlayerPoolManager({ auctionId, poolPlayers, captainUserIds = [], onPoolChange }) {
  const [allPlayers, setAllPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(null); // player.id being added

  useEffect(() => {
    playerService.listPlayers({ activeOnly: true }).then(setAllPlayers).catch(() => {});
  }, []);

  const poolIds        = new Set(poolPlayers.map(p => p.player_id));
  const captainIdSet   = new Set(captainUserIds);
  const captainPlayers = allPlayers.filter(p => p.user_id && captainIdSet.has(p.user_id));
  const captainPIds    = new Set(captainPlayers.map(p => p.id));

  // Players already in pool (excluding captains who are auto-sold)
  const inPool = poolPlayers
    .filter(pp => !captainPIds.has(pp.player_id))
    .map(pp => ({
      poolRow: pp,
      player: allPlayers.find(p => p.id === pp.player_id),
    }))
    .filter(x => x.player); // skip if player data not loaded yet

  // Available players — not in pool, not captain, matches search
  const available = allPlayers.filter(p =>
    !poolIds.has(p.id) &&
    !captainPIds.has(p.id) &&
    (!search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.role?.toLowerCase().includes(search.toLowerCase()))
  );

  async function handleAdd(player) {
    setAdding(player.id);
    try {
      await auctionService.addPlayerToPool(auctionId, player.id, 100);
      onPoolChange();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAdding(null);
    }
  }

  async function handleRemove(poolRow) {
    try {
      await auctionService.removePlayerFromPool(poolRow.id);
      onPoolChange();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const ROLE_COLOR = {
    batsman:     'text-blue-600 dark:text-blue-400',
    bowler:      'text-red-600 dark:text-red-400',
    'all-rounder': 'text-purple-600 dark:text-purple-400',
    keeper:      'text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="space-y-5">

      {/* ── In Pool ────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider">
            In Pool
          </p>
          <span className="text-xs font-bold text-brand-green tabular-nums">
            {inPool.length} player{inPool.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Captains — auto-sold at their base price; price is editable */}
        {captainPlayers.map(p => {
          const captainPoolRow = poolPlayers.find(pp => pp.player_id === p.id) ?? null;
          return (
            <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20">
              <PlayerAvatar player={p} size="sm" />
              <div className="flex-1 min-w-0">
                <PlayerName player={p} nameClass="text-sm text-ink-900 dark:text-white" />
                <p className={`text-[11px] font-medium capitalize ${ROLE_COLOR[p.role] ?? 'text-ink-400'}`}>{p.role}</p>
              </div>
              <PriceCell
                row={captainPoolRow}
                onCreate={price => auctionService.addPlayerToPool(auctionId, p.id, price)}
                onSaved={onPoolChange}
              />
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0 flex items-center gap-1 ml-1">
                👑
              </span>
            </div>
          );
        })}

        {inPool.length === 0 && captainPlayers.length === 0 && (
          <p className="text-sm text-ink-400 text-center py-4">No players added yet — tap + below to add</p>
        )}

        {inPool.map(({ poolRow, player }) => (
          <div key={poolRow.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 bg-green-50 dark:bg-green-500/10 border border-green-200/60 dark:border-green-500/20">
            <PlayerAvatar player={player} size="sm" />
            <div className="flex-1 min-w-0">
              <PlayerName player={player} nameClass="text-sm text-ink-900 dark:text-white" />
              <p className={`text-[11px] font-medium capitalize ${ROLE_COLOR[player.role] ?? 'text-ink-400'}`}>{player.role}</p>
            </div>
            {/* Tap price pill to edit inline */}
            <PriceCell row={poolRow} onSaved={onPoolChange} />
            <button
              onClick={() => handleRemove(poolRow)}
              className="p-1.5 rounded-lg text-ink-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors ml-1"
              title="Remove from pool"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Add Players ────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-ink-500 dark:text-ink-400 uppercase tracking-wider mb-2">
          Add Players
        </p>

        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or role…"
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-ink-200 dark:border-white/10 bg-white dark:bg-ink-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
        </div>

        {available.length === 0 && (
          <p className="text-sm text-ink-400 text-center py-4">
            {search ? `No players match "${search}"` : 'All players added to pool'}
          </p>
        )}

        <div className="space-y-1.5">
          {available.map(player => (
            <div
              key={player.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-ink-800/50 border border-ink-100 dark:border-white/5"
            >
              <PlayerAvatar player={player} size="sm" />
              <div className="flex-1 min-w-0">
                <PlayerName player={player} nameClass="text-sm text-ink-900 dark:text-white" />
                <p className={`text-[11px] font-medium capitalize ${ROLE_COLOR[player.role] ?? 'text-ink-400'}`}>{player.role}</p>
              </div>
              <button
                onClick={() => handleAdd(player)}
                disabled={adding === player.id}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full bg-brand-green/10 text-brand-green text-xs font-bold hover:bg-brand-green hover:text-white transition-colors disabled:opacity-50"
              >
                {adding === player.id
                  ? <span className="w-3 h-3 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
                  : <Check size={12} />
                }
                Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
