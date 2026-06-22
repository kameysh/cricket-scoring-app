export default function BidLog({ bids, teams }) {
  if (!bids?.length) {
    return (
      <div className="card px-4 py-2.5">
        <p className="text-xs text-ink-400 text-center">No bids yet for this player</p>
      </div>
    );
  }

  return (
    <div className="card px-4 py-2.5 overflow-hidden">
      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider mb-1.5">Bid Log</p>
      <div className="max-h-28 overflow-y-auto divide-y divide-ink-100 dark:divide-white/5">
        {bids.map((bid, i) => {
          const teamName = bid.auction_team?.name
            ?? teams?.find(t => t.id === bid.auction_team_id)?.name
            ?? '—';
          return (
            <div key={bid.id ?? i} className="flex items-center justify-between py-1.5">
              <span className="text-xs font-semibold text-ink-700 dark:text-ink-200 truncate">{teamName}</span>
              <span className="text-xs tabular-nums font-bold text-brand-green ml-3 shrink-0">
                ₹{bid.amount?.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
