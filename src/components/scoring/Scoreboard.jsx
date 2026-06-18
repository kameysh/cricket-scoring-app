import { formatOvers, calcCRR, calcRRR, fmt } from '../../lib/cricketUtils';

export default function Scoreboard({ match, innings, battingTeamName }) {
  if (!innings) return null;
  const overs = formatOvers(innings.total_legal_balls);
  const crr = calcCRR(innings.total_runs, innings.total_legal_balls);
  const totalLegalBalls = match.total_overs * 6;
  const ballsRemaining = totalLegalBalls - innings.total_legal_balls;

  let rrrInfo = null;
  if (innings.innings_number === 2 && innings.target) {
    const needed = innings.target - innings.total_runs;
    const rrr = calcRRR(needed, ballsRemaining);
    rrrInfo = { needed: Math.max(needed, 0), ballsRemaining, rrr };
  }

  return (
    <div className="sticky top-0 z-30 bg-gradient-to-r from-brand-green via-brand-teal to-brand-blue text-white px-4 py-3 shadow-pill">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{battingTeamName}</span>
        <span className="text-2xl font-bold tabular-nums">{innings.total_runs}/{innings.total_wickets}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-white/85 mt-1">
        <span>Overs: {overs}/{match.total_overs}</span>
        <span>CRR: {fmt(crr)}</span>
        {rrrInfo && <span>Need {rrrInfo.needed} off {rrrInfo.ballsRemaining} — RRR {fmt(rrrInfo.rrr)}</span>}
      </div>
    </div>
  );
}
