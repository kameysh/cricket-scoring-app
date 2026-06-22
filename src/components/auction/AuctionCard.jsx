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

export default function AuctionCard({ auction, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full card p-4 flex items-center justify-between gap-3 text-left"
    >
      <div>
        <p className="font-semibold text-ink-900 dark:text-white">{auction.name}</p>
        <p className="text-xs text-ink-400 mt-0.5">Budget ₹{auction.budget_per_team.toLocaleString()} / team</p>
      </div>
      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[auction.status] ?? STATUS_STYLES.draft}`}>
        {auction.status === 'live' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse" />}
        {STATUS_LABEL[auction.status] ?? auction.status}
      </span>
    </button>
  );
}
