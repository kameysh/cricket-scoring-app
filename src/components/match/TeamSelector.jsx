import { X, ShieldCheck } from 'lucide-react';
import PlayerAvatar from '../player/PlayerAvatar';
import PlayerSearch from './PlayerSearch';

export default function TeamSelector({ teamLabel, players, selectedIds, onToggle, disabledIds, onQuickAdd, targetSize }) {
  const count = selectedIds.length;
  const pct = targetSize ? Math.min(100, Math.round((count / targetSize) * 100)) : 0;
  const complete = targetSize ? count >= targetSize : false;

  return (
    <div className="card p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <h4 className="text-[15px] font-bold text-ink-900 dark:text-white flex items-center gap-1.5">
          {complete && <ShieldCheck size={15} className="text-brand-teal" />}
          {teamLabel}
        </h4>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full tabular-nums transition-colors ${complete ? 'bg-gradient-to-r from-brand-green via-brand-teal to-brand-blue text-white' : 'bg-ink-100 dark:bg-white/10 text-ink-500 dark:text-ink-100'}`}>
          {count}{targetSize ? ` / ${targetSize}` : ''}
        </span>
      </div>

      {targetSize > 0 && (
        <div className="h-1.5 rounded-full bg-ink-100 dark:bg-white/10 overflow-hidden">
          <div className="h-full transition-all duration-300 bg-gradient-to-r from-brand-green via-brand-teal to-brand-blue" style={{ width: `${pct}%` }} />
        </div>
      )}

      {count > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {selectedIds.map(id => {
            const p = players.find(pl => pl.id === id);
            if (!p) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggle(id)}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-ink-50 dark:bg-white/[0.06] border border-ink-200 dark:border-white/10 flex-shrink-0 group hover:border-red-300"
              >
                <PlayerAvatar name={p.name} photoUrl={p.photo_url} size={20} />
                <span className="text-xs font-medium text-ink-700 dark:text-ink-100 whitespace-nowrap">{p.name}</span>
                <X size={12} className="text-ink-400 group-hover:text-red-500" />
              </button>
            );
          })}
        </div>
      )}

      <PlayerSearch players={players} selectedIds={selectedIds} onToggle={onToggle} disabledIds={disabledIds} onQuickAdd={onQuickAdd} />
    </div>
  );
}
