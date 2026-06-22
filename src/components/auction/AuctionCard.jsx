const STATUS_STYLES = {
  draft:          'bg-ink-100 text-ink-500 dark:bg-white/10 dark:text-ink-300',
  setup_complete: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  live:           'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
  paused:         'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  completed:      'bg-ink-100 text-ink-400 dark:bg-white/5 dark:text-ink-400',
};

const STATUS_LABEL = {
  draft: 'Draft', setup_complete: 'Ready', live: 'LIVE', paused: 'Paused', completed: 'Completed',
};

const STATUS_ICON = {
  draft: '📝', setup_complete: '✅', live: '🔴', paused: '⏸', completed: '🏁',
};

export default function AuctionCard({ auction, onClick }) {
  const isLive = auction.status === 'live';

  return (
    <button
      onClick={onClick}
      className={`w-full card p-4 text-left transition-all active:scale-[0.98] ${isLive ? 'ring-2 ring-brand-green/40' : ''}`}
    >
      {/* Top row: name + status badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink-900 dark:text-white text-base leading-tight">{auction.name}</p>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${STATUS_STYLES[auction.status] ?? STATUS_STYLES.draft}`}>
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
          {STATUS_LABEL[auction.status] ?? auction.status}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Budget / Team</span>
          <span className="text-sm font-bold text-ink-800 dark:text-ink-100 tabular-nums">₹{auction.budget_per_team?.toLocaleString()}</span>
        </div>
        {auction.bid_increments?.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Min Bid Step</span>
            <span className="text-sm font-bold text-ink-800 dark:text-ink-100 tabular-nums">₹{Math.min(...auction.bid_increments).toLocaleString()}</span>
          </div>
        )}
        <div className="ml-auto flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">Status</span>
          <span className="text-sm">{STATUS_ICON[auction.status] ?? '📋'}</span>
        </div>
      </div>

      {/* Live CTA */}
      {isLive && (
        <div className="mt-3 pt-3 border-t border-brand-green/20 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
          <span className="text-xs font-semibold text-brand-green">Auction in progress — tap to join</span>
        </div>
      )}
    </button>
  );
}
