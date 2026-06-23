export default function BidLog({ bids, teams }) {
  if (!bids?.length) {
    return (
      <div className="card px-4 py-3">
        <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1">Bid History</p>
        <p className="text-xs text-ink-300 dark:text-ink-600">No bids yet for this player</p>
      </div>
    );
  }

  return (
    <div className="card px-4 py-3">
      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-2">Bid History</p>
      <div className="max-h-36 overflow-y-auto divide-y divide-ink-100 dark:divide-white/5">
        {bids.map((bid, i) => {
          const teamName = bid.auction_team?.name
            ?? teams?.find(t => t.id === bid.auction_team_id)?.name
            ?? '—';
          const isLatest = i === 0;
          return (
            <div key={bid.id ?? i} className={`flex items-center justify-between py-2 ${isLatest ? 'opacity-100' : 'opacity-60'}`}>
              <div className="flex items-center gap-2 min-w-0">
                {isLatest && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />}
                <span className="text-sm font-semibold text-ink-800 dark:text-ink-100 truncate">{teamName}</span>
              </div>
              <span className={`tabular-nums font-bold ml-3 shrink-0 ${isLatest ? 'text-base text-brand-green' : 'text-sm text-ink-500 dark:text-ink-400'}`}>
                ₹{bid.amount?.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
