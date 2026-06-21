import { useState, useMemo } from 'react';
import { ArrowLeftRight, RotateCcw, ChevronRight } from 'lucide-react';
import BottomSheet from '../shared/BottomSheet';
import PlayerAvatar from '../player/PlayerAvatar';

/**
 * Mid-match player substitution sheet — 1-for-1 swap.
 *
 * Flow:
 *   Step 1 — pick who goes OUT from the active squad
 *   Step 2 — pick who comes IN from available players
 *   Benched — subbed-out players shown with "Swap Back" button
 *
 * Props:
 *   open             – boolean
 *   onClose          – () => void
 *   match            – { team1_name, team2_name }
 *   matchPlayers     – match_players rows with .players join (all, incl. inactive)
 *   allPlayers       – full player pool from playerService.listPlayers
 *   onSwap           – (outMatchPlayerId, inPlayerId, team) => Promise<void>
 *   onSwapBack       – (subMatchPlayerId, originalMatchPlayerId) => Promise<void>
 */
export default function PlayerSubSheet({ open, onClose, match, matchPlayers, allPlayers, onSwap, onSwapBack }) {
  const [selectedTeam, setSelectedTeam] = useState(1);
  const [outgoing, setOutgoing] = useState(null); // match_players row being subbed out
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const teamName = t => t === 1 ? match?.team1_name : match?.team2_name;

  // All match_players for selected team (active + inactive)
  const teamMps = useMemo(() =>
    matchPlayers.filter(mp => mp.team === selectedTeam || mp.team === 0),
    [matchPlayers, selectedTeam]
  );

  const activeSquad = useMemo(() => teamMps.filter(mp => mp.is_active !== false), [teamMps]);
  const benchedMps  = useMemo(() => teamMps.filter(mp => mp.is_active === false), [teamMps]);

  // Player IDs already in this match (any team) to exclude from available list
  const squadIds = useMemo(() => new Set(matchPlayers.map(mp => mp.player_id)), [matchPlayers]);

  const available = useMemo(() =>
    (allPlayers || []).filter(p =>
      !squadIds.has(p.id) &&
      (search.trim() === '' || p.name.toLowerCase().includes(search.trim().toLowerCase()))
    ),
    [allPlayers, squadIds, search]
  );

  function handleTeamChange(t) {
    setSelectedTeam(t);
    setOutgoing(null);
    setSearch('');
  }

  function handleSelectOutgoing(mp) {
    setOutgoing(mp);
    setSearch('');
  }

  async function handleSwapIn(inPlayer) {
    if (!outgoing || busy) return;
    setBusy(true);
    try {
      await onSwap(outgoing.id, inPlayer.id, selectedTeam);
      setOutgoing(null);
      setSearch('');
    } finally {
      setBusy(false);
    }
  }

  async function handleSwapBack(benchedMp) {
    if (busy) return;
    setBusy(true);
    try {
      await onSwapBack(benchedMp.id);
    } finally {
      setBusy(false);
    }
  }

  const step = outgoing ? 2 : 1;

  return (
    <BottomSheet open={open} onClose={() => { setOutgoing(null); onClose(); }} title="Player Sub" heightClass="max-h-[80vh]">

      {/* Team tabs */}
      <div className="flex gap-2 mb-4">
        {[1, 2].map(t => (
          <button key={t} type="button" onClick={() => handleTeamChange(t)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              selectedTeam === t
                ? 'bg-brand-green text-white'
                : 'bg-ink-100 dark:bg-white/10 text-ink-600 dark:text-ink-300'
            }`}>
            {teamName(t) || `Team ${t}`}
          </button>
        ))}
      </div>

      {step === 1 ? (
        <>
          {/* ── Step 1: pick who goes out ── */}
          <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-3">
            Tap a player to <span className="text-red-500 font-bold">sub out</span>
          </p>

          <div className="space-y-1">
            {activeSquad.length === 0 && (
              <p className="text-xs text-ink-400 text-center py-4">No active players</p>
            )}
            {activeSquad.map(mp => {
              const p = mp.players;
              if (!p) return null;
              return (
                <button key={mp.id} type="button" onClick={() => handleSelectOutgoing(mp)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-transparent hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors group">
                  <PlayerAvatar name={p.name} photoUrl={p.photo_url} size={32} />
                  <span className="flex-1 text-left text-sm font-medium text-ink-900 dark:text-white truncate">{p.name}</span>
                  {mp.is_substitute && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400">Sub</span>
                  )}
                  <ChevronRight size={14} className="text-ink-300 group-hover:text-red-400 shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Benched players */}
          {benchedMps.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <ArrowLeftRight size={11} /> Benched
              </p>
              <div className="space-y-1">
                {benchedMps.map(mp => {
                  const p = mp.players;
                  if (!p) return null;
                  // Show Swap Back only if there's a linked active sub for this specific player
                  const hasLinkedSub = matchPlayers.some(
                    s => s.subbed_out_player_id === mp.id && s.is_active !== false
                  );
                  return (
                    <div key={mp.id}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-100 dark:border-white/10">
                      <PlayerAvatar name={p.name} photoUrl={p.photo_url} size={32} />
                      <span className="flex-1 text-sm font-medium text-ink-400 dark:text-ink-400 truncate line-through">{p.name}</span>
                      {hasLinkedSub && (
                        <button type="button" disabled={busy}
                          onClick={() => handleSwapBack(mp)}
                          className="flex items-center gap-1 text-xs font-semibold text-brand-green px-2 py-1 rounded-lg hover:bg-brand-green/10 transition-colors disabled:opacity-40">
                          <RotateCcw size={11} /> Swap Back
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* ── Step 2: pick who comes in ── */}
          <div className="flex items-center gap-2 mb-4">
            <button type="button" onClick={() => setOutgoing(null)}
              className="text-xs text-ink-400 hover:text-ink-700 dark:hover:text-white">
              ← Back
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-xl">
              <PlayerAvatar name={outgoing.players?.name} photoUrl={outgoing.players?.photo_url} size={24} />
              <span className="text-sm font-medium text-red-600 dark:text-red-400 truncate">{outgoing.players?.name}</span>
              <ArrowLeftRight size={13} className="shrink-0 text-red-400" />
              <span className="text-xs text-ink-400 shrink-0">going out</span>
            </div>
          </div>

          <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2">
            Select replacement:
          </p>

          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search players…" className="field-input !py-1.5 !text-sm mb-3" />

          <div className="space-y-1">
            {available.length === 0 && (
              <p className="text-xs text-ink-400 text-center py-4">
                {search ? 'No players match your search' : 'No available players to sub in'}
              </p>
            )}
            {available.map(p => (
              <button key={p.id} type="button" disabled={busy}
                onClick={() => handleSwapIn(p)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-brand-green/5 border border-transparent hover:border-brand-green/30 transition-colors disabled:opacity-40">
                <PlayerAvatar name={p.name} photoUrl={p.photo_url} size={32} />
                <span className="flex-1 text-left text-sm font-medium text-ink-900 dark:text-white truncate">{p.name}</span>
                {p.is_guest && <span className="text-[10px] text-amber-500">Guest</span>}
                <span className="shrink-0 text-xs font-semibold text-brand-green">Sub In →</span>
              </button>
            ))}
          </div>
        </>
      )}
    </BottomSheet>
  );
}
