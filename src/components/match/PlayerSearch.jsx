import { useState, useMemo } from 'react';
import { Search, UserPlus, Check, X } from 'lucide-react';
import PlayerAvatar from '../player/PlayerAvatar';

export default function PlayerSearch({ players, selectedIds = [], onToggle, disabledIds = [], onQuickAdd, maxSelectable }) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(
    () => players.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [players, search]
  );

  const exactMatch = players.some(p => p.name.toLowerCase() === search.trim().toLowerCase());
  const canQuickAdd = onQuickAdd && search.trim().length >= 2 && !exactMatch;
  const atCap = maxSelectable != null && selectedIds.length >= maxSelectable;

  async function handleQuickAdd() {
    if (!canQuickAdd || adding) return;
    setAdding(true);
    try {
      await onQuickAdd(search.trim());
      setSearch('');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar — series only */}
      {maxSelectable && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-ink-500 dark:text-ink-400">Players selected</span>
            <span className={`text-sm font-bold tabular-nums ${atCap ? 'text-brand-green' : 'text-ink-700 dark:text-white'}`}>
              {selectedIds.length} <span className="text-ink-400 font-normal">/ {maxSelectable}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-ink-100 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-green to-brand-teal transition-all duration-300"
              style={{ width: `${Math.min((selectedIds.length / maxSelectable) * 100, 100)}%` }}
            />
          </div>
          {atCap && (
            <p className="text-xs text-brand-green font-medium mt-1">Squad complete ✓</p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search players…"
          className="field-input !pl-10 !pr-9 !rounded-full !bg-ink-50 dark:!bg-white/5"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Quick add */}
      {canQuickAdd && (
        <button
          type="button"
          onClick={handleQuickAdd}
          disabled={adding}
          className="flex items-center gap-2.5 px-4 py-3 mb-2 rounded-2xl bg-ink-50 dark:bg-white/5 text-sm font-medium hover:bg-ink-100 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-brand-green to-brand-teal text-white flex-shrink-0">
            <UserPlus size={15} />
          </span>
          <span className="text-ink-700 dark:text-white">
            {adding ? 'Adding…' : <>Create &ldquo;<strong>{search.trim()}</strong>&rdquo;</>}
          </span>
        </button>
      )}

      {/* Player list — fills remaining sheet height */}
      <div className="flex-1 space-y-1 overflow-y-auto -mx-4 px-4">
        {filtered.map(p => {
          const selected = selectedIds.includes(p.id);
          const onOtherTeam = disabledIds.includes(p.id) && !selected;
          const disabled = onOtherTeam || (!selected && atCap);
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(p.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left transition-all ${
                selected
                  ? 'bg-brand-green/10 dark:bg-brand-green/20 border border-brand-green/30'
                  : disabled
                  ? 'opacity-35 cursor-not-allowed border border-transparent'
                  : 'hover:bg-ink-50 dark:hover:bg-white/5 border border-transparent active:scale-[0.98]'
              }`}
            >
              <PlayerAvatar name={p.name} photoUrl={p.photo_url} size={36} />
              <span className={`flex-1 min-w-0 text-sm font-medium truncate ${selected ? 'text-brand-green dark:text-brand-green' : 'text-ink-800 dark:text-white'}`}>
                {p.name}
              </span>
              {onOtherTeam && (
                <span className="text-[10px] text-ink-400 shrink-0">Other team</span>
              )}
              {selected ? (
                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-brand-green text-white">
                  <Check size={13} strokeWidth={3} />
                </span>
              ) : !disabled ? (
                <span className="flex-shrink-0 w-6 h-6 rounded-full border-2 border-ink-200 dark:border-white/20" />
              ) : null}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-ink-400">No players found</p>
            {onQuickAdd && <p className="text-xs text-ink-400 mt-1">Type a name above to create one</p>}
          </div>
        )}
      </div>
    </div>
  );
}
