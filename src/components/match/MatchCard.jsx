import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { useRole } from '../../hooks/useRole';
import { matchDateValue } from '../../lib/cricketUtils';

const statusColors = {
  upcoming: 'bg-gray-100 text-gray-700',
  live: 'bg-red-100 text-red-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  abandoned: 'bg-gray-100 text-gray-500',
  no_result: 'bg-gray-100 text-gray-500',
};

export default function MatchCard({ match, onDelete, matchNumber }) {
  const navigate = useNavigate();
  const { canScore } = useRole();
  const target = match.status === 'completed' ? `/matches/${match.id}/summary` : `/matches/${match.id}`;
  const numLabel = matchNumber != null ? `Match ${String(matchNumber).padStart(2, '0')} · ` : '';

  return (
    <div className="relative card p-4 space-y-2">
      <button onClick={() => navigate(target)} className="w-full text-left space-y-2">
        <div className="flex items-center justify-between pr-7">
          <div className="flex items-center gap-1.5">
            {matchNumber != null && (
              <span className="text-[11px] font-semibold tracking-widest text-ink-400 uppercase">
                {numLabel}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[match.status] || ''}`}>
              {match.status === 'live' && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              )}
              {match.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-gray-400">{matchDateValue(match) && format(matchDateValue(match), 'dd MMM yyyy')}</span>
        </div>
        <div className="font-semibold text-gray-900 dark:text-white">
          {match.team1_name} vs {match.team2_name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {match.venues?.name && `${match.venues.name} · `}{match.tournaments?.name || `${match.total_overs} overs`}
        </div>
        {match.status === 'completed' && match.result_summary && (
          <p className="text-sm font-medium text-cricket-green dark:text-cricket-gold">{match.result_summary}</p>
        )}
      </button>
      {onDelete && canScore && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(match); }}
          aria-label="Delete match"
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-ink-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
