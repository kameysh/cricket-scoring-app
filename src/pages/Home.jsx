import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Swords, Trophy, Users, BarChart2, ChevronRight, Zap, PauseCircle } from 'lucide-react';
import * as matchService from '../services/matchService';
import * as playerService from '../services/playerService';
import * as tournamentService from '../services/tournamentService';
import MatchCard from '../components/match/MatchCard';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { useRole } from '../hooks/useRole';
import { useAuthStore } from '../stores/authStore';

export default function Home() {
  const navigate = useNavigate();
  const { canScore, isPlayer, userId } = useRole();
  const user = useAuthStore(s => s.user);

  const [matches, setMatches] = useState([]);
  const [allStats, setAllStats] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => {
    Promise.all([
      matchService.listMatches(),
      playerService.getAllCareerStats().catch(() => []),
      tournamentService.listTournaments().catch(() => []),
    ]).then(([m, s, t]) => {
      setMatches(m);
      setAllStats(s);
      setTournaments(t);
    }).catch(e => {
      toast.error('Failed to load home data');
    }).finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    try {
      await matchService.deleteMatch(toDelete.id);
      setMatches(ms => ms.filter(m => m.id !== toDelete.id));
      toast.success('Match deleted');
    } catch (e) {
      toast.error(e.message || 'Failed to delete match');
    } finally {
      setToDelete(null);
    }
  }

  const live = matches.filter(m => m.status === 'live' || m.status === 'paused');
  const recent = matches.filter(m => m.status === 'completed').slice(0, 3);
  const topScorer = allStats.length > 0 ? allStats[0] : null; // already sorted by bat_runs desc
  const topWickets = [...allStats].sort((a, b) => b.bowl_wickets - a.bowl_wickets).find(s => s.bowl_wickets > 0) || null;
  const activeTournament = tournaments.find(t => t.status !== 'completed') || null;

  return (
    <div className="p-4 space-y-5 page-transition">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cricket Scorer</h1>
          {user?.email && <p className="text-xs text-ink-400 mt-0.5">Welcome back</p>}
        </div>
        {canScore ? (
          <button onClick={() => navigate('/matches/new')} className="btn-chip">
            <Plus size={16} /> New Match
          </button>
        ) : isPlayer && userId ? (
          <button onClick={() => navigate(`/players/${userId}`)} className="btn-chip">
            My Profile
          </button>
        ) : null}
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <>
          {/* Live Match Hero */}
          {live.length > 0 && (
            <section className="space-y-2">
              {live.map(m => (
                <div
                  key={m.id}
                  className="rounded-2xl border-2 border-brand-green/40 bg-gradient-to-br from-brand-green/5 to-brand-teal/5 dark:from-brand-green/10 dark:to-brand-teal/10 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                      m.status === 'live'
                        ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                        : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                    }`}>
                      {m.status === 'live'
                        ? <><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE</>
                        : <><PauseCircle size={11} /> PAUSED</>
                      }
                    </span>
                    {m.tournaments?.name && (
                      <span className="text-xs text-ink-400 dark:text-ink-500 truncate max-w-[140px]">{m.tournaments.name}</span>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-lg font-bold text-ink-900 dark:text-white leading-tight">
                      {m.team1_name} <span className="text-ink-400 font-normal text-base">vs</span> {m.team2_name}
                    </p>
                    {m.venues?.name && (
                      <p className="text-xs text-ink-400 mt-0.5">{m.venues.name}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {canScore && (
                      <button
                        onClick={() => navigate(`/matches/${m.id}`)}
                        className="flex-1 btn-primary !py-2 text-sm"
                      >
                        Resume Scoring
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/matches/${m.id}/scorecard`)}
                      className="flex-1 py-2 rounded-xl border border-ink-200 dark:border-white/10 text-sm font-medium text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-white/5"
                    >
                      View Scorecard
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Quick Stats Strip */}
          <section>
            <div className="grid grid-cols-2 gap-2.5">
              <StatPill
                icon={<Swords size={15} className="text-brand-green" />}
                label="Matches"
                value={matches.length}
              />
              <StatPill
                icon={<Users size={15} className="text-brand-teal" />}
                label="Players"
                value={allStats.length || '—'}
              />
              <StatPill
                icon={<BarChart2 size={15} className="text-amber-500" />}
                label="Top Scorer"
                value={topScorer ? topScorer.bat_runs : '—'}
                sub={topScorer?.players?.name || null}
                onClick={topScorer?.players?.id ? () => navigate(`/players/${topScorer.players.id}`) : undefined}
              />
              <StatPill
                icon={<Zap size={15} className="text-purple-500" />}
                label="Top Wickets"
                value={topWickets ? topWickets.bowl_wickets : '—'}
                sub={topWickets?.players?.name || null}
                onClick={topWickets?.players?.id ? () => navigate(`/players/${topWickets.players.id}`) : undefined}
              />
            </div>
          </section>

          {/* Active Tournament Banner */}
          {activeTournament && (
            <section>
              <button
                onClick={() => navigate(`/tournaments/${activeTournament.id}`)}
                className="w-full card p-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Trophy size={17} className="text-amber-500" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900 dark:text-white text-sm leading-tight">{activeTournament.name}</p>
                    <p className="text-xs text-ink-400 mt-0.5 capitalize">
                      {activeTournament.status === 'ongoing' ? 'In Progress' : activeTournament.status || 'Upcoming'}
                      {activeTournament.tournament_teams?.[0]?.count > 0
                        ? ` · ${activeTournament.tournament_teams[0].count} teams`
                        : ''}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-ink-400 flex-shrink-0" />
              </button>
            </section>
          )}

          {/* Recent Matches */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-ink-500 dark:text-ink-400">Recent Matches</h2>
              {matches.filter(m => m.status === 'completed').length > 3 && (
                <button
                  onClick={() => navigate('/matches')}
                  className="text-xs text-brand-green font-medium"
                >
                  See all
                </button>
              )}
            </div>
            {recent.length === 0 ? (
              <EmptyState
                icon={Swords}
                title="No matches yet"
                message={canScore ? 'Tap "+ New Match" to start your first match.' : 'No completed matches to show yet.'}
              />
            ) : (
              <div className="space-y-2">
                {recent.map(m => (
                  <MatchCard key={m.id} match={m} onDelete={canScore ? setToDelete : undefined} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this match?"
        message={toDelete ? `${toDelete.team1_name} vs ${toDelete.team2_name} — this permanently deletes the match, all deliveries, and scorecards. This cannot be undone.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}

function StatPill({ icon, label, value, sub, onClick }) {
  const inner = (
    <div className="card p-3 flex items-center gap-2.5 w-full text-left">
      <span className="flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-ink-400 uppercase tracking-wide font-medium leading-none mb-0.5">{label}</p>
        <p className="text-base font-bold text-ink-900 dark:text-white leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-ink-400 truncate mt-0.5">{sub}</p>}
      </div>
      {onClick && <ChevronRight size={14} className="text-ink-300 ml-auto flex-shrink-0" />}
    </div>
  );

  return onClick
    ? <button onClick={onClick} className="w-full rounded-2xl">{inner}</button>
    : <div>{inner}</div>;
}
