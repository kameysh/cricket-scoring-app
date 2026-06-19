import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowLeftRight, Trophy, Activity } from 'lucide-react';
import * as matchService from '../services/matchService';
import PlayerAvatar from '../components/player/PlayerAvatar';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function WinBar({ aWins, bWins, ties, teamA, teamB }) {
  const total = aWins + bWins + ties;
  if (total === 0) return null;
  const aPct = Math.round((aWins / total) * 100);
  const bPct = Math.round((bWins / total) * 100);
  const tPct = 100 - aPct - bPct;

  return (
    <div className="space-y-1">
      <div className="flex h-2 rounded-full overflow-hidden">
        {aPct > 0 && <div className="bg-brand-green transition-all" style={{ width: `${aPct}%` }} />}
        {tPct > 0 && <div className="bg-ink-300 dark:bg-white/20 transition-all" style={{ width: `${tPct}%` }} />}
        {bPct > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${bPct}%` }} />}
      </div>
      <div className="flex justify-between text-[11px] text-ink-500">
        <span className="text-brand-green font-semibold">{teamA}: {aWins}W ({aPct}%)</span>
        {ties > 0 && <span>{ties} Tie{ties > 1 ? 's' : ''}</span>}
        <span className="text-amber-500 font-semibold">{teamB}: {bWins}W ({bPct}%)</span>
      </div>
    </div>
  );
}

export default function HeadToHead() {
  const navigate = useNavigate();
  const [teamNames, setTeamNames] = useState([]);
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [matches, setMatches] = useState(null);
  const [performers, setPerformers] = useState(null);
  const [loading, setLoading] = useState(false);
  const [namesLoading, setNamesLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    matchService.getDistinctTeamNames()
      .then(setTeamNames)
      .catch(() => setTeamNames([]))
      .finally(() => setNamesLoading(false));
  }, []);

  useEffect(() => {
    if (!teamA || !teamB || teamA === teamB) { setMatches(null); setPerformers(null); return; }
    setLoading(true);
    setError(null);
    matchService.getH2HMatches(teamA, teamB)
      .then(async data => {
        setMatches(data);
        if (data.length > 0) {
          const perf = await matchService.getH2HTopPerformers(data.map(m => m.id));
          setPerformers(perf);
        } else {
          setPerformers(null);
        }
      })
      .catch(e => setError(e.message || 'Failed to load matches'))
      .finally(() => setLoading(false));
  }, [teamA, teamB]);

  // Compute record
  let aWins = 0, bWins = 0, ties = 0;
  const aScores = [], bScores = [];
  if (matches) {
    for (const m of matches) {
      if (m.result_type === 'tie') { ties++; }
      else if (m.winning_team_name === teamA) aWins++;
      else if (m.winning_team_name === teamB) bWins++;

      // Avg scores: innings[0] = team1's innings (batting_team=1), innings[1] = team2's
      const inn1 = (m.innings || []).find(i => i.innings_number === 1);
      const inn2 = (m.innings || []).find(i => i.innings_number === 2);
      if (m.team1_name === teamA) {
        if (inn1) aScores.push(inn1.total_runs);
        if (inn2) bScores.push(inn2.total_runs);
      } else {
        if (inn1) bScores.push(inn1.total_runs);
        if (inn2) aScores.push(inn2.total_runs);
      }
    }
  }
  const avgA = aScores.length ? Math.round(aScores.reduce((s, r) => s + r, 0) / aScores.length) : null;
  const avgB = bScores.length ? Math.round(bScores.reduce((s, r) => s + r, 0) / bScores.length) : null;

  const recent = matches?.slice(0, 5) || [];

  const canCompare = teamA && teamB && teamA !== teamB;

  return (
    <div className="p-4 space-y-4 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-ink-900 dark:text-white flex-1">Team Head-to-Head</h1>
      </div>

      {/* Team Selector */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Team A</label>
            <select
              value={teamA}
              onChange={e => setTeamA(e.target.value)}
              className="field-input w-full"
              disabled={namesLoading}
            >
              <option value="">Select team…</option>
              {teamNames.filter(n => n !== teamB).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <button
            type="button"
            onClick={() => { const tmp = teamA; setTeamA(teamB); setTeamB(tmp); }}
            disabled={!teamA || !teamB}
            className="mt-5 p-2 rounded-lg border border-ink-200 dark:border-white/10 hover:bg-ink-100 dark:hover:bg-white/10 disabled:opacity-30"
            title="Swap teams"
          >
            <ArrowLeftRight size={16} />
          </button>

          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Team B</label>
            <select
              value={teamB}
              onChange={e => setTeamB(e.target.value)}
              className="field-input w-full"
              disabled={namesLoading}
            >
              <option value="">Select team…</option>
              {teamNames.filter(n => n !== teamA).map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        {namesLoading && <p className="text-xs text-ink-400 text-center">Loading teams…</p>}
        {!namesLoading && teamNames.length === 0 && (
          <p className="text-xs text-ink-400 text-center">No completed matches yet.</p>
        )}
      </div>

      {!canCompare && teamNames.length > 0 && (
        <p className="text-sm text-ink-400 text-center py-4">Select both teams to compare</p>
      )}

      {canCompare && loading && <LoadingSkeleton rows={4} />}

      {canCompare && error && (
        <p className="text-sm text-red-500 text-center py-4">{error}</p>
      )}

      {canCompare && !loading && matches !== null && (
        <>
          {matches.length === 0 ? (
            <div className="card p-6 text-center space-y-2">
              <Activity size={32} className="mx-auto text-ink-300" />
              <p className="text-sm font-medium text-ink-600 dark:text-ink-300">No matches found between these teams</p>
              <p className="text-xs text-ink-400">Completed matches between {teamA} and {teamB} will appear here.</p>
            </div>
          ) : (
            <>
              {/* Win/Loss Record */}
              <div className="card p-4 space-y-3">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Win / Loss Record</p>
                <div className="flex justify-around text-center">
                  <div>
                    <p className="text-2xl font-bold text-brand-green">{aWins}</p>
                    <p className="text-[11px] text-ink-500 truncate max-w-[90px]">{teamA}</p>
                  </div>
                  {ties > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-ink-400">{ties}</p>
                      <p className="text-[11px] text-ink-500">Tied</p>
                    </div>
                  )}
                  <div>
                    <p className="text-2xl font-bold text-amber-500">{bWins}</p>
                    <p className="text-[11px] text-ink-500 truncate max-w-[90px]">{teamB}</p>
                  </div>
                </div>
                <WinBar aWins={aWins} bWins={bWins} ties={ties} teamA={teamA} teamB={teamB} />
              </div>

              {/* Avg Scores */}
              {(avgA !== null || avgB !== null) && (
                <div className="card p-4 space-y-2">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Average Score</p>
                  <div className="flex justify-around text-center">
                    <div>
                      <p className="text-xl font-bold text-ink-900 dark:text-white">{avgA ?? '—'}</p>
                      <p className="text-[11px] text-ink-500 truncate max-w-[90px]">{teamA}</p>
                    </div>
                    <div className="text-ink-300 self-center text-sm">vs</div>
                    <div>
                      <p className="text-xl font-bold text-ink-900 dark:text-white">{avgB ?? '—'}</p>
                      <p className="text-[11px] text-ink-500 truncate max-w-[90px]">{teamB}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Results */}
              <div className="card p-4 space-y-3">
                <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide">Recent Results</p>
                <div className="space-y-2">
                  {recent.map(m => {
                    const winner = m.winning_team_name;
                    const loser = winner === m.team1_name ? m.team2_name : m.team1_name;
                    const isTie = m.result_type === 'tie';
                    return (
                      <div key={m.id} className="flex items-center justify-between text-xs py-1 border-b border-ink-50 dark:border-white/5 last:border-0">
                        <span className="text-ink-400">{formatDate(m.created_at)}</span>
                        <span className="font-medium text-ink-800 dark:text-ink-100">
                          {isTie ? 'Tied' : <>{winner} <span className="text-ink-400">beat</span> {loser}</>}
                          {m.winning_margin && !isTie && (
                            <span className="text-ink-400"> · {m.winning_margin} {m.result_type === 'runs' ? 'runs' : 'wkts'}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Performers */}
              {performers && (
                <div className="card p-4 space-y-4">
                  <p className="text-xs font-semibold text-ink-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Trophy size={12} /> Top Performers in H2H
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-ink-500">🏏 Batting</p>
                      {performers.topBatsmen.length === 0 && <p className="text-xs text-ink-400">—</p>}
                      {performers.topBatsmen.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <PlayerAvatar name={p.player?.name} photoUrl={p.player?.photo_url} size={24} />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink-800 dark:text-ink-100 truncate">{p.player?.name || '—'}</p>
                            <p className="text-[11px] text-ink-400">{p.runs} runs</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-ink-500">🎳 Bowling</p>
                      {performers.topBowlers.length === 0 && <p className="text-xs text-ink-400">—</p>}
                      {performers.topBowlers.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <PlayerAvatar name={p.player?.name} photoUrl={p.player?.photo_url} size={24} />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink-800 dark:text-ink-100 truncate">{p.player?.name || '—'}</p>
                            <p className="text-[11px] text-ink-400">{p.wickets} wkts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
