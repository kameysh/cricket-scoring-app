import { computeBadges } from '../../lib/cricketUtils';

export default function PlayerBadges({ stats, duckHunterCount = 0, allStats = [] }) {
  if (!stats) return null;

  const badges = computeBadges(stats, duckHunterCount, allStats);
  const earned = badges.filter(b => b.earned);

  if (earned.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-widest">Badges</p>
      <div className="flex flex-wrap gap-2">
        {earned.map(b => (
          <span
            key={b.id}
            title={b.hint}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-green/10 dark:bg-brand-green/20 text-brand-green border border-brand-green/20"
          >
            {b.emoji} {b.label}{b.count != null && b.count > 1 ? ` ×${b.count}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
