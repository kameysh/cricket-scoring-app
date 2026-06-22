import { useState } from 'react';

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
  bidIncrements = [50, 100, 200, 500, 1000],
  teams = [],
  loading = false,
}) {
  const isLive = auctionStatus === 'live';
  const hasBid = activePlayer?.current_bid != null;

  // Which team the auctioneer is raising the bid for
  const [raiseTeamId, setRaiseTeamId] = useState('');
  const effectiveRaiseTeamId = raiseTeamId || activePlayer?.leading_team_id || teams[0]?.id || '';
  const raiseTeam = teams.find(t => t.id === effectiveRaiseTeamId);

  const currentBid = activePlayer?.current_bid ?? activePlayer?.base_price ?? 0;

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
          {/* Team selector for raise bid */}
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

          {/* Budget remaining for selected team */}
          {raiseTeam && (
            <p className="text-[11px] text-ink-400">
              {raiseTeam.name} purse left:{' '}
              <span className="font-semibold text-ink-700 dark:text-ink-200 tabular-nums">
                ₹{raiseTeam.budget_remaining?.toLocaleString()}
              </span>
            </p>
          )}

          {/* Raise increment buttons */}
          <p className="text-[11px] text-ink-400">Raise bid to:</p>
          <div className="flex flex-wrap gap-1.5">
            {bidIncrements.map(inc => {
              const nextBid = currentBid + inc;
              const overBudget = raiseTeam != null && nextBid > raiseTeam.budget_remaining;
              return (
                <button
                  key={inc}
                  onClick={() => onRaise(nextBid, effectiveRaiseTeamId)}
                  disabled={loading || overBudget}
                  title={overBudget ? `Exceeds ${raiseTeam?.name} purse` : undefined}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    overBudget
                      ? 'bg-red-50 text-red-400 dark:bg-red-900/20'
                      : 'bg-ink-100 dark:bg-white/10 text-ink-700 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-white/20'
                  }`}
                >
                  +{inc} → ₹{nextBid.toLocaleString()}
                </button>
              );
            })}
          </div>
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
