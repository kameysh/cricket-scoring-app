export default function BidLog({ bids, teams }) {
  if (!bids?.length) {
    return (
      <div className="card px-4 py-3">
        <p className="text-xs text-ink-400 text-center">No bids yet for this player</p>
      </div>
    );
  }

  return (
    <div className="card px-4 py-3 space-y-2 max-h-40 overflow-y-auto">
      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Bid Log</p>
      {bids.map((bid, i) => {
        const teamName = bid.auction_team?.team?.name ?? teams?.find(t => t.id === bid.auction_team_id)?.team?.name ?? '—';
        return (
          <div key={bid.id ?? i} className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink-700 dark:text-ink-200">{teamName}</span>
            <span className="tabular-nums font-bold text-brand-green">₹{bid.amount?.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
