export default function CaptainControls({
  auctionTeamId,
  activePlayer,
  bidIncrements = [50, 100, 200, 500, 1000],
  budgetRemaining = 0,
  hasPassed = false,
  onBid,
  onPass,
  loading = false,
}) {
  if (!activePlayer) {
    return (
      <div data-testid="captain-controls" className="card px-4 py-3 text-center text-sm text-ink-400">
        Waiting for next player…
      </div>
    );
  }

  const currentBid = activePlayer.current_bid ?? activePlayer.base_price ?? 0;

  return (
    <div data-testid="captain-controls" className="card px-4 py-3 space-y-3">
      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Your Bid</p>
      <div className="flex flex-wrap gap-2">
        {bidIncrements.map(inc => {
          const bid = currentBid + inc;
          const overBudget = bid > budgetRemaining;
          return (
            <button
              key={inc}
              onClick={() => onBid(bid)}
              disabled={loading || overBudget || hasPassed}
              data-testid={`bid-btn-${inc}`}
              className={`flex-1 min-w-[70px] py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                ${overBudget ? 'bg-red-50 text-red-300 dark:bg-red-900/20' : 'bg-brand-green text-white hover:opacity-90'}`}
            >
              +{inc}
              <span className="block text-[10px] font-normal opacity-80">₹{bid.toLocaleString()}</span>
            </button>
          );
        })}
      </div>
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
