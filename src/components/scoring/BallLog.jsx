import { useState } from 'react';
import PlayerLink from '../player/PlayerLink';
import { displayName } from '../../lib/cricketUtils';

function chipLabel(d) {
  if (d.is_wicket) return 'W';
  if (d.extra_type === 'wide') return `wd${d.total_runs_on_delivery > 1 ? '+' + (d.total_runs_on_delivery - 1) : ''}`;
  if (d.extra_type === 'no_ball') return `nb${d.runs_off_bat ? '+' + d.runs_off_bat : ''}`;
  if (d.extra_type === 'bye') return `${d.extra_runs}b`;
  if (d.extra_type === 'leg_bye') return `${d.extra_runs}lb`;
  if (d.extra_type === 'penalty_batting' || d.extra_type === 'penalty_fielding') return `P${d.extra_runs}`;
  if (d.runs_off_bat === 0) return '•';
  return String(d.runs_off_bat);
}

function chipColor(d) {
  if (d.is_wicket) return 'bg-red-600 text-white';
  if (d.runs_off_bat === 4) return 'bg-cricket-green text-white';
  if (d.runs_off_bat === 6) return 'bg-cricket-gold text-white';
  if (d.extra_type !== 'none') return 'bg-amber-100 text-amber-800';
  return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200';
}

export default function BallLog({ deliveries, matchPlayers = [] }) {
  const [popover, setPopover] = useState(null);
  const recent = deliveries.slice(-24);

  // Deliveries added during the session carry only IDs (no joined name objects).
  // Fall back to matchPlayers lookup so names always show in the popover.
  function resolveName(id, joinedObj) {
    const dn = displayName(joinedObj);
    if (dn) return dn;
    return displayName(matchPlayers.find(mp => mp.players?.id === id)?.players) || null;
  }

  return (
    <div className="card p-3">
      <h4 className="text-xs font-semibold text-gray-500 mb-2">Recent Balls</h4>
      <div className="flex flex-wrap gap-1.5">
        {recent.map((d, i) => (
          <button
            key={d.id || i}
            onClick={() => setPopover(d)}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${chipColor(d)}`}
          >
            {chipLabel(d)}
          </button>
        ))}
      </div>

      {popover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPopover(null)}>
          <div className="card p-4 max-w-xs w-full text-sm space-y-1" onClick={e => e.stopPropagation()}>
            <p>Over {popover.over_number}.{popover.ball_number}</p>
            <p>Batsman: <PlayerLink id={popover.batsman_id} name={resolveName(popover.batsman_id, popover.batsman)} liveScoring /></p>
            <p>Bowler: <PlayerLink id={popover.bowler_id} name={resolveName(popover.bowler_id, popover.bowler)} liveScoring /></p>
            <p>Runs: {popover.total_runs_on_delivery}{popover.is_wicket ? ' · WICKET' : ''}</p>
          </div>
        </div>
      )}
    </div>
  );
}
