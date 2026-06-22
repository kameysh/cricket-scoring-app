import PlayerAvatar from '../player/PlayerAvatar';

export default function HeldQueue({ heldPlayers, isAdmin, onReorder, onReturnToPool }) {
  if (!heldPlayers?.length) {
    return <p className="text-sm text-ink-400 text-center py-4">No players in the held queue</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">
        Held Queue — {heldPlayers.length} player{heldPlayers.length !== 1 ? 's' : ''}
      </p>
      {heldPlayers.map((ap, idx) => (
        <div key={ap.id} className="flex items-center gap-3 p-2 rounded-xl bg-ink-50 dark:bg-white/5">
          <span className="w-6 text-center text-xs font-bold text-ink-400 tabular-nums">{idx + 1}</span>
          <PlayerAvatar player={ap.player} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{ap.player?.name}</p>
            <p className="text-[11px] text-ink-400">Base ₹{ap.base_price?.toLocaleString()}</p>
          </div>
          {isAdmin && onReturnToPool && (
            <button
              data-testid={`return-to-pool-${ap.id}`}
              onClick={() => onReturnToPool(ap.id)}
              className="text-[11px] font-semibold text-brand-green hover:text-green-700 dark:hover:text-green-400 transition-colors px-2 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10"
            >
              ↩ Pool
            </button>
          )}
          {isAdmin && (
            <span className="text-ink-300 dark:text-ink-600 text-xs select-none">⠿</span>
          )}
        </div>
      ))}
      {isAdmin && (
        <p className="text-[11px] text-ink-400 text-center">Held players re-enter after pool is empty (FIFO)</p>
      )}
    </div>
  );
}
