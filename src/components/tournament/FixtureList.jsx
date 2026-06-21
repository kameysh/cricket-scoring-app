import { format } from 'date-fns';
import { Play, Trash2, Lock } from 'lucide-react';
import MatchCard from '../match/MatchCard';

const DONE_STATUSES = ['completed', 'no_result', 'abandoned'];

function UpcomingFixtureCard({ match, onStart, matchNumber, locked, prevMatchNumber }) {
  const numLabel = matchNumber != null ? `Match ${String(matchNumber).padStart(2, '0')} · ` : '';
  return (
    <div className={`card overflow-hidden ${locked ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-ink-100 dark:border-white/5">
        <span className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">{numLabel}Upcoming</span>
        <span className="text-[11px] text-ink-400">{match.created_at && format(new Date(match.created_at), 'dd MMM yyyy')}</span>
      </div>

      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-ink-900 dark:text-white truncate">{match.team1_name}</span>
            <span className="text-xs font-semibold text-ink-400 shrink-0">vs</span>
            <span className="font-bold text-base text-ink-900 dark:text-white truncate">{match.team2_name}</span>
          </div>
          <p className="text-xs text-ink-400">
            {[match.venues?.name, `${match.total_overs} overs`].filter(Boolean).join(' · ')}
          </p>
        </div>

        {locked ? (
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink-100 dark:bg-white/10 text-xs font-semibold text-ink-400">
            <Lock size={12} />
            {prevMatchNumber != null ? `After Match ${String(prevMatchNumber).padStart(2, '0')}` : 'Locked'}
          </div>
        ) : onStart ? (
          <button
            onClick={() => onStart(match.id)}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-brand-green/90 active:scale-95 transition-all shadow-sm"
          >
            <Play size={13} fill="white" strokeWidth={0} />
            Start
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DeletedFixtureCard({ matchNumber }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 dark:border-white/10 bg-ink-50/50 dark:bg-white/[0.02] px-4 py-3 flex items-center justify-between opacity-60">
      <div className="space-y-1">
        <span className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">Match {matchNumber} · Deleted</span>
        <p className="text-sm font-medium text-ink-400 line-through">This match was removed</p>
      </div>
      <Trash2 size={16} className="text-ink-300 shrink-0" />
    </div>
  );
}

export default function FixtureList({ matches, onStart, seriesTotal }) {
  const realCount = matches?.length ?? 0;
  // Only show tombstones when at least one real match exists — otherwise it's a clean slate.
  const deletedCount = (seriesTotal && realCount > 0) ? Math.max(0, seriesTotal - realCount) : 0;

  if (realCount === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No matches scheduled</p>;
  }

  return (
    <div className="space-y-3">
      {matches.map((m, i) => {
        const prev = matches[i - 1];
        const locked = seriesTotal && i > 0 && prev && !DONE_STATUSES.includes(prev.status);
        return onStart && m.status === 'upcoming'
          ? <UpcomingFixtureCard key={m.id} match={m} onStart={onStart} matchNumber={i + 1} locked={locked} prevMatchNumber={i} />
          : <MatchCard key={m.id} match={m} matchNumber={i + 1} />;
      })}
      {Array.from({ length: deletedCount }, (_, i) => (
        <DeletedFixtureCard key={`deleted-${i}`} matchNumber={matches.length + i + 1} />
      ))}
    </div>
  );
}
