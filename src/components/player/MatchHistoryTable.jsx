import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { calcStrikeRate, fmt } from '../../lib/cricketUtils';

function resultBadge(match, playerTeam) {
  if (match.status !== 'completed') return null;
  if (match.result_type === 'tie') return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700">Tied</span>;
  if (match.result_type === 'no_result' || match.result_type === 'abandoned') return <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-200 text-gray-700">NR</span>;
  if (!playerTeam) return null;
  const teamName = playerTeam === 1 ? match.team1_name : match.team2_name;
  const won = match.winning_team_name === teamName;
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${won ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
      {won ? 'Won' : 'Lost'}
    </span>
  );
}

export default function MatchHistoryTable({ history }) {
  const navigate = useNavigate();

  if (!history || history.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No matches played yet</p>;
  }

  return (
    <div className="space-y-2">
      {history.map(({ match, batting, bowling, fielding }) => {
        const fieldingTotal = (fielding?.catches || 0) + (fielding?.stumpings || 0) + (fielding?.run_outs || 0);
        return (
          <button
            key={match.id}
            onClick={() => navigate(`/matches/${match.id}/scorecard`)}
            className="w-full text-left card p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{match.created_at && format(new Date(match.created_at), 'dd MMM yyyy')}</span>
              {resultBadge(match, batting?.team || bowling?.team)}
            </div>
            <div className="font-medium text-sm text-gray-900 dark:text-white">
              {match.team1_name} vs {match.team2_name}
            </div>
            {(match.tournaments?.name || match.venues?.name) && (
              <div className="text-xs text-gray-400">
                {[match.tournaments?.name, match.venues?.name].filter(Boolean).join(' · ')}
              </div>
            )}
            {batting && (
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Batting: {batting.runs} ({batting.balls_faced}) · {batting.fours}×4 · {batting.sixes}×6
                {batting.dismissal_type ? ` — ${batting.dismissal_type}` : ' — not out'}
                {' · SR ' + fmt(calcStrikeRate(batting.runs, batting.balls_faced))}
              </div>
            )}
            {bowling && bowling.legal_balls > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Bowling: {bowling.wickets}/{bowling.runs_conceded} in {Math.floor(bowling.legal_balls / 6)}.{bowling.legal_balls % 6} ov
              </div>
            )}
            {fieldingTotal > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Fielding: {fielding.catches}c {fielding.stumpings}st {fielding.run_outs}ro
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
