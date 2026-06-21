import { formatOvers, calcCRR, calcRRR, fmt } from '../../lib/cricketUtils';

export default function Scoreboard({ match, innings, battingTeamName, matchNumber }) {
  if (!innings) return null;
  const overs = formatOvers(innings.total_legal_balls);
  const crr = calcCRR(innings.total_runs, innings.total_legal_balls);
  const maxBalls = innings.is_super_over ? 6 : match.total_overs * 6;
  const totalLegalBalls = maxBalls;
  const ballsRemaining = totalLegalBalls - innings.total_legal_balls;

  let rrrInfo = null;
  if ((innings.innings_number === 2 || innings.is_super_over) && innings.target) {
    const needed = innings.target - innings.total_runs;
    const rrr = calcRRR(needed, ballsRemaining);
    rrrInfo = { needed: Math.max(needed, 0), ballsRemaining, rrr };
  }

  return (
    <div className="sticky top-0 z-30 bg-gradient-to-r from-brand-green via-brand-teal to-brand-blue text-white px-4 py-3 shadow-pill">
      {innings.is_super_over && (
        <p className="text-[10px] font-semibold tracking-widest text-amber-300 uppercase mb-1">⚡ Super Over</p>
      )}
      {!innings.is_super_over && matchNumber != null && (
        <p className="text-[10px] font-semibold tracking-widest text-white/60 uppercase mb-1">Match {String(matchNumber).padStart(2, '0')}</p>
      )}
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{battingTeamName}</span>
        <span className="text-2xl font-bold tabular-nums">{innings.total_runs}/{innings.total_wickets}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-white/85 mt-1">
        <span>Overs: {overs}/{innings.is_super_over ? 1 : match.total_overs}</span>
        <span>CRR: {fmt(crr)}</span>
        {rrrInfo && <span>Need {rrrInfo.needed} off {rrrInfo.ballsRemaining} — RRR {fmt(rrrInfo.rrr)}</span>}
      </div>
    </div>
  );
}
