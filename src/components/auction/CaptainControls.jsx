import { useState } from 'react';

const haptic = (ms = 12) => navigator.vibrate?.(ms);

export default function CaptainControls({
  auctionTeamId,
  activePlayer,
  bidIncrements = [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
  budgetRemaining = 0,
  maxBid = null,
  hasPassed = false,
  onBid,
  onPass,
  loading = false,
}) {
  const [chipCounts, setChipCounts] = useState({});

  if (!activePlayer) {
    return (
      <div data-testid="captain-controls" className="card px-4 py-3 text-center text-sm text-ink-400">
        Waiting for next player…
      </div>
    );
  }

  const currentBid = activePlayer.current_bid ?? activePlayer.base_price ?? 0;
  const totalIncrement = Object.entries(chipCounts).reduce((sum, [inc, cnt]) => sum + Number(inc) * cnt, 0);
  const nextBid = currentBid + totalIncrement;
  const effectiveMax = maxBid != null ? Math.min(maxBid, budgetRemaining) : budgetRemaining;
  const overBudget = totalIncrement > 0 && nextBid > effectiveMax;

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

  function handleBid() {
    if (totalIncrement === 0) return;
    haptic(20);
    onBid(nextBid);
    setChipCounts({});
  }

  function chipLabel(inc) {
    return inc >= 1000 ? `+₹${inc / 1000}K` : `+₹${inc}`;
  }

  return (
    <div data-testid="captain-controls" className="card px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Your Bid</p>
        {maxBid != null && (
          <p className="text-[11px] text-ink-400">
            Max:{' '}
            <span className={`font-semibold tabular-nums ${effectiveMax <= 0 ? 'text-red-500' : 'text-brand-green'}`}>
              ₹{Math.max(0, effectiveMax).toLocaleString()}
            </span>
          </p>
        )}
      </div>

      {/* Multi-tap chips */}
      <div className="grid grid-cols-5 gap-1.5">
        {bidIncrements.map(inc => {
          const count = chipCounts[inc] ?? 0;
          const wouldExceed = (currentBid + totalIncrement + inc) > effectiveMax;
          return (
            <div key={inc} className="relative">
              <button
                data-testid={`bid-btn-${inc}`}
                onClick={() => incrementChip(inc)}
                disabled={loading || hasPassed || wouldExceed}
                title={`+₹${(inc).toLocaleString()}`}
                className={`w-full py-2.5 rounded-lg text-xs font-bold text-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  count > 0
                    ? 'bg-brand-green text-white'
                    : wouldExceed
                      ? 'bg-red-50 text-red-300 dark:bg-red-900/20'
                      : 'bg-ink-100 dark:bg-white/10 text-ink-700 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-white/20'
                }`}
              >
                {chipLabel(inc)}
              </button>
              {count > 0 && (
                <button
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

      {/* Confirm bid button */}
      {totalIncrement > 0 && (
        <div className="flex gap-2">
          <button
            data-testid="confirm-bid-btn"
            onClick={handleBid}
            disabled={loading || overBudget || hasPassed}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 ${
              overBudget
                ? 'bg-red-100 text-red-500 dark:bg-red-900/20'
                : 'bg-brand-green text-white hover:opacity-90'
            }`}
          >
            {overBudget ? 'Over budget' : `Bid ₹${nextBid.toLocaleString()}`}
          </button>
          <button
            onClick={() => setChipCounts({})}
            disabled={loading}
            className="px-3 py-2.5 rounded-xl text-xs font-semibold bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-300"
          >
            Clear
          </button>
        </div>
      )}

      <button
        onClick={onPass}
        disabled={loading || hasPassed}
        data-testid="pass-btn"
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
          hasPassed
            ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300 cursor-default'
            : 'bg-ink-100 text-ink-600 dark:bg-white/10 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-white/20'
        }`}
      >
        {hasPassed ? '✋ Passing' : 'Pass'}
      </button>
    </div>
  );
}
