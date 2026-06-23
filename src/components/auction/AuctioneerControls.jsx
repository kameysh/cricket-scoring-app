import { useState } from 'react';

const haptic = (ms = 12) => navigator.vibrate?.(ms);

export default function AuctioneerControls({
  auctionId,
  activePlayer,
  bothPassing,
  onNextPlayer,
  onRaise,
  onUndoBid,
  onDeal,
  onHold,
  onUnsold,
  onPause,
  onResume,
  auctionStatus,
  bidIncrements = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
  teams = [],
  teamMaxBids = {},
  loading = false,
}) {
  const isLive = auctionStatus === 'live';
  const hasBid = activePlayer?.current_bid != null;

  const [raiseTeamId, setRaiseTeamId] = useState('');
  const effectiveRaiseTeamId = raiseTeamId || activePlayer?.leading_team_id || teams[0]?.id || '';
  const raiseTeam = teams.find(t => t.id === effectiveRaiseTeamId);

  // Multi-tap state: { [inc]: count }
  const [chipCounts, setChipCounts] = useState({});

  const currentBid = activePlayer?.current_bid ?? activePlayer?.base_price ?? 0;
  const totalIncrement = Object.entries(chipCounts).reduce((sum, [inc, cnt]) => sum + Number(inc) * cnt, 0);
  const nextBid = currentBid + totalIncrement;
  const raiseTeamMaxBid = raiseTeam != null
    ? (teamMaxBids[raiseTeam.id] ?? raiseTeam.budget_remaining ?? 0)
    : Infinity;
  const overRawBudget = raiseTeam != null && totalIncrement > 0 && nextBid > (raiseTeam.budget_remaining ?? 0);
  const overReserve = !overRawBudget && raiseTeam != null && totalIncrement > 0 && nextBid > raiseTeamMaxBid;
  const overBudget = overRawBudget || overReserve;

  function incrementChip(inc) {
    haptic();
    setChipCounts(prev => ({ ...prev, [inc]: (prev[inc] ?? 0) + 1 }));
  }

  function decrementChip(inc) {
    haptic(6);
    setChipCounts(prev => {
      const next = { ...prev, [inc]: Math.max(0, (prev[inc] ?? 0) - 1) };
      if (next[inc] === 0) delete next[inc];
      return next;
    });
  }

  function resetChips() {
    haptic(20);
    setChipCounts({});
  }

  function handleRaise() {
    if (totalIncrement === 0) return;
    onRaise(nextBid, effectiveRaiseTeamId);
    // Auto-advance to next team
    const idx = teams.findIndex(t => t.id === effectiveRaiseTeamId);
    const next = teams[(idx + 1) % teams.length];
    if (next) setRaiseTeamId(next.id);
    resetChips();
  }

  function chipLabel(inc) {
    return inc >= 1000 ? `+₹${inc / 1000}K` : `+₹${inc}`;
  }

  return (
    <div data-testid="auctioneer-controls" className="card px-4 py-2.5 space-y-2.5">
      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Auctioneer Controls</p>

      {/* Next Player / Pause / Resume row */}
      <div className="flex gap-2">
        <button
          onClick={onNextPlayer}
          disabled={loading || !!activePlayer}
          className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-40"
        >
          🎲 Next Player
        </button>
        {isLive ? (
          <button onClick={onPause} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 disabled:opacity-40">
            Pause
          </button>
        ) : (
          <button onClick={onResume} disabled={loading} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 disabled:opacity-40">
            Resume
          </button>
        )}
      </div>

      {/* Raise bid section — only when a player is active */}
      {activePlayer && (
        <div className="space-y-2">
          {/* Team selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[11px] text-ink-400 shrink-0">Raise bid for:</p>
            <div className="flex gap-1.5 flex-wrap">
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setRaiseTeamId(t.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                    t.id === effectiveRaiseTeamId
                      ? 'bg-brand-green text-white border-brand-green'
                      : 'bg-transparent text-ink-500 border-ink-200 dark:border-white/20 hover:border-brand-green'
                  }`}
                >
                  {t.name ?? `Team ${teams.indexOf(t) + 1}`}
                </button>
              ))}
            </div>
          </div>

          {/* Purse remaining + max bid */}
          {raiseTeam && (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[11px] text-ink-400">
                Purse:{' '}
                <span className="font-semibold text-ink-700 dark:text-ink-200 tabular-nums">
                  ₹{raiseTeam.budget_remaining?.toLocaleString()}
                </span>
              </p>
              {teamMaxBids[raiseTeam.id] != null && (
                <p className="text-[11px] text-ink-400">
                  Max bid:{' '}
                  <span className={`font-semibold tabular-nums ${raiseTeamMaxBid <= 0 ? 'text-red-500' : 'text-brand-green'}`}>
                    ₹{Math.max(0, raiseTeamMaxBid).toLocaleString()}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Multi-tap chips */}
          <p className="text-[11px] text-ink-400">Tap to add · tap count to remove:</p>
          <div className="grid grid-cols-5 gap-1.5">
            {bidIncrements.map(inc => {
              const count = chipCounts[inc] ?? 0;
              return (
                <div key={inc} className="relative">
                  <button
                    data-testid={`chip-${inc}`}
                    onClick={() => incrementChip(inc)}
                    disabled={loading}
                    className={`w-full py-2.5 rounded-lg text-xs font-bold text-center transition-colors disabled:opacity-40 ${
                      count > 0
                        ? 'bg-brand-green text-white'
                        : 'bg-ink-100 dark:bg-white/10 text-ink-700 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-white/20'
                    }`}
                  >
                    {chipLabel(inc)}
                  </button>
                  {count > 0 && (
                    <button
                      data-testid={`chip-count-${inc}`}
                      onClick={() => decrementChip(inc)}
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-ink-900 dark:bg-white text-white dark:text-ink-900 text-[10px] font-extrabold flex items-center justify-center leading-none"
                    >
                      ×{count}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Confirm raise button — appears when chips selected */}
          {totalIncrement > 0 && (
            <div className="flex gap-2 items-center">
              <button
                data-testid="confirm-raise-btn"
                onClick={handleRaise}
                disabled={loading || overBudget}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 ${
                  overBudget
                    ? 'bg-red-100 text-red-500 dark:bg-red-900/20'
                    : 'bg-brand-green text-white hover:opacity-90'
                }`}
              >
                {overRawBudget ? 'Exceeds purse' : overReserve ? 'Need purse for remaining picks' : `Raise → ₹${nextBid.toLocaleString()}`}
              </button>
              <button
                onClick={resetChips}
                disabled={loading}
                className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-300 hover:bg-ink-200 dark:hover:bg-white/20"
              >
                Clear
              </button>
            </div>
          )}

          {/* Undo last bid */}
          {hasBid && (
            <button
              data-testid="undo-bid-btn"
              onClick={onUndoBid}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-500 dark:text-red-400 hover:text-red-700 disabled:opacity-40 mt-1"
            >
              ↩ Undo Last Bid
            </button>
          )}
        </div>
      )}

      {/* Deal / Hold / Unsold row */}
      {activePlayer && (
        <div className="flex gap-2">
          <button
            data-testid="deal-btn"
            onClick={onDeal}
            disabled={loading || !hasBid}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-brand-green text-white hover:opacity-90 disabled:opacity-40"
          >
            🔨 Deal
          </button>
          <button
            data-testid="hold-btn"
            onClick={onHold}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 ${
              bothPassing
                ? 'bg-amber-400 text-white animate-pulse'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
            }`}
          >
            ✋ Hold
          </button>
          <button
            data-testid="unsold-btn"
            onClick={onUnsold}
            disabled={loading || hasBid}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-ink-100 text-ink-500 dark:bg-white/10 dark:text-ink-300 disabled:opacity-40"
          >
            Unsold
          </button>
        </div>
      )}
    </div>
  );
}
