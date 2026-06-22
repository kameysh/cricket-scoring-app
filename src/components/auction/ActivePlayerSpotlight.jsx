import PlayerAvatar from '../player/PlayerAvatar';

const ROLE_COLORS = {
  batsman: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  bowler: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  'all-rounder': 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  keeper: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
};

export default function ActivePlayerSpotlight({ player, leadingTeam }) {
  if (!player) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center text-center gap-2 min-h-[220px]">
        <p className="text-4xl">🏏</p>
        <p className="text-sm text-ink-400 dark:text-ink-500">Waiting for auctioneer to call next player…</p>
      </div>
    );
  }

  const p = player.player;
  const hasBid = player.current_bid != null;
  const bidAmount = player.current_bid ?? player.base_price;

  return (
    <div className="card overflow-hidden">
      {/* Green header band */}
      <div className="bg-gradient-to-r from-brand-green to-brand-teal px-4 py-3 flex items-center gap-3">
        <PlayerAvatar player={p} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-lg leading-tight truncate">{p?.name ?? '—'}</p>
          {p?.role && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${ROLE_COLORS[p.role] ?? 'bg-white/20 text-white'}`}>
              {p.role}
            </span>
          )}
        </div>
      </div>

      {/* Bid section */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[11px] text-ink-400 uppercase tracking-wider font-semibold">
              {hasBid ? 'Current Bid' : 'Base Price'}
            </p>
            <p className="text-4xl font-extrabold text-ink-900 dark:text-white tabular-nums">
              ₹{bidAmount?.toLocaleString()}
            </p>
          </div>
          {leadingTeam && (
            <div className="text-right">
              <p className="text-[11px] text-ink-400 uppercase tracking-wider font-semibold">Leading</p>
              <p className="font-bold text-brand-green text-base">{leadingTeam.team?.name ?? '—'}</p>
            </div>
          )}
        </div>
        {!hasBid && (
          <p className="text-xs text-ink-400 text-center py-1">No bids yet — base price shown</p>
        )}
      </div>
    </div>
  );
}
