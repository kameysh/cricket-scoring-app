import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Plus, Swords, Trophy, Users, BarChart2, ChevronRight, Zap, PauseCircle, Trash2, Gavel } from 'lucide-react';
import * as matchService from '../services/matchService';
import * as playerService from '../services/playerService';
import * as tournamentService from '../services/tournamentService';
import { listAuctions } from '../services/auctionService';
import { getActivePromo } from '../services/promoService';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import PlayerAvatar from '../components/player/PlayerAvatar';
import { useRole } from '../hooks/useRole';
import { useAuthStore } from '../stores/authStore';
import { formatOvers, matchDateValue } from '../lib/cricketUtils';
import { supabase } from '../lib/supabase';

export default function Home() {
  const navigate = useNavigate();
  const { canScore, isPlayer, userId } = useRole();
  const user = useAuthStore(s => s.user);

  const [matches, setMatches] = useState([]);
  const [allStats, setAllStats] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [liveAuctions, setLiveAuctions] = useState([]);
  const [activePromo, setActivePromo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);
  const [matchStats, setMatchStats] = useState({});
  const [liveInnings, setLiveInnings] = useState({});

  const reloadMatches = useCallback(() => {
    matchService.listMatches().then(setMatches).catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      matchService.listMatches(),
      playerService.getAllCareerStats().catch(() => []),
      tournamentService.listTournaments().catch(() => []),
      listAuctions().catch(() => []),
      getActivePromo().catch(() => null),
    ]).then(([m, s, t, auctions, promo]) => {
      setMatches(m);
      setAllStats(s);
      setTournaments(t);
      setLiveAuctions(auctions.filter(a => a.status === 'live' || a.status === 'paused'));
      setActivePromo(promo);
    }).catch(() => {
      toast.error('Failed to load home data');
    }).finally(() => setLoading(false));
  }, []);

  // Realtime: refresh match list when any match status changes (live → completed, etc.)
  useEffect(() => {
    const channel = supabase
      .channel('home:matches')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' },
        () => reloadMatches()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [reloadMatches]);

  // Load innings for live matches and subscribe to score updates
  useEffect(() => {
    const live = matches.filter(m => m.status === 'live' || m.status === 'paused');
    if (live.length === 0) { setLiveInnings({}); return; }

    Promise.allSettled(live.map(async m => {
      const innings = await matchService.getInnings(m.id);
      return [m.id, innings];
    })).then(results => {
      const map = {};
      results.forEach(r => {
        if (r.status === 'fulfilled') { const [mid, inn] = r.value; map[mid] = inn; }
      });
      setLiveInnings(map);
    });

    // Subscribe to innings score changes so live totals refresh without page reload
    const channel = supabase
      .channel('home:live-innings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'innings' },
        payload => {
          const matchId = payload.new.match_id;
          setLiveInnings(prev => {
            if (!prev[matchId]) return prev;
            return {
              ...prev,
              [matchId]: prev[matchId].map(inn => inn.id === payload.new.id ? { ...inn, ...payload.new } : inn),
            };
          });
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'innings' },
        payload => {
          const matchId = payload.new.match_id;
          setLiveInnings(prev => {
            if (!prev[matchId]) return prev;
            return { ...prev, [matchId]: [...prev[matchId], payload.new] };
          });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [matches]);

  // Load innings + scorecards for recent completed matches
  useEffect(() => {
    const recent = matches.filter(m => m.status === 'completed').slice(-3);
    if (recent.length === 0) return;

    Promise.allSettled(recent.map(async m => {
      const innings = await matchService.getInnings(m.id);
      const cardMap = {};
      await Promise.allSettled(innings.map(async inn => {
        cardMap[inn.id] = await matchService.getScorecards(inn.id);
      }));
      return [m.id, { innings, cardMap }];
    })).then(results => {
      const statsMap = {};
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          const [matchId, data] = r.value;
          statsMap[matchId] = data;
        }
      });
      setMatchStats(statsMap);
    });
  }, [matches]);

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
  const recent = matches.filter(m => m.status === 'completed').slice(-3);
  const topScorer = allStats.length > 0 ? allStats[0] : null;
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
                    <p className="text-sm font-semibold text-ink-500 dark:text-ink-400 tracking-wide uppercase mb-2">
                      {m.team1_name} <span className="text-ink-300 font-normal">vs</span> {m.team2_name}
                    </p>
                    {/* Live scores */}
                    {(() => {
                      const innings = liveInnings[m.id] || [];
                      const t1 = innings.find(i => i.batting_team === 1);
                      const t2 = innings.find(i => i.batting_team === 2);
                      const cur = innings.filter(i => !i.is_completed).slice(-1)[0];
                      if (!t1 && !t2) return (
                        <p className="text-xs text-ink-400 mt-0.5">Loading score…</p>
                      );
                      return (
                        <div className="flex items-center justify-center gap-4 mt-1">
                          {[{ name: m.team1_name, inn: t1, isBatting: cur?.batting_team === 1 },
                            { name: m.team2_name, inn: t2, isBatting: cur?.batting_team === 2 }].map(({ name, inn, isBatting }) => (
                            <div key={name} className={`flex flex-col items-center ${isBatting ? '' : 'opacity-60'}`}>
                              <span className="text-xs font-medium text-ink-500 dark:text-ink-400 truncate max-w-[110px]">{name}</span>
                              {inn ? (
                                <>
                                  <span className="text-2xl font-extrabold text-ink-900 dark:text-white leading-tight">
                                    {inn.total_runs}/{inn.total_wickets}
                                  </span>
                                  <span className="text-xs text-ink-400">({formatOvers(inn.total_legal_balls)} ov)</span>
                                </>
                              ) : (
                                <span className="text-2xl font-extrabold text-ink-400">Yet to bat</span>
                              )}
                              {isBatting && <span className="mt-0.5 text-[10px] font-bold text-brand-green uppercase tracking-wide">Batting</span>}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    {m.venues?.name && (
                      <p className="text-xs text-ink-400 mt-1">{m.venues.name}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {canScore && (
                      <button onClick={() => navigate(`/matches/${m.id}`)} className="flex-1 btn-primary !py-2 text-sm">
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

          {/* Live Auction Hero */}
          {liveAuctions.length > 0 && (
            <section className="space-y-2">
              {liveAuctions.map(a => (
                <div
                  key={a.id}
                  className="rounded-2xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                      a.status === 'live'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                    }`}>
                      <Gavel size={11} />
                      {a.status === 'live' ? (
                        <><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> AUCTION LIVE</>
                      ) : 'AUCTION PAUSED'}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-ink-900 dark:text-white text-base">{a.name}</p>
                    <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">Player auction in progress — tap to follow live</p>
                  </div>
                  <button
                    onClick={() => navigate(`/auctions/${a.id}`)}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-colors"
                  >
                    Join Auction →
                  </button>
                </div>
              ))}
            </section>
          )}

          {/* Tournament Promo Banner */}
          {activePromo && (
            <section>
              <div className="rounded-2xl overflow-hidden shadow-sm border border-ink-100 dark:border-white/10">
                <div className="relative" style={{ aspectRatio: '16/9' }}>
                  <img
                    src={activePromo.banner_url}
                    alt={activePromo.tournament_name || 'Tournament'}
                    className="w-full h-full object-contain"
                  />
                </div>
                {(activePromo.tournament_name || activePromo.team1_name) && (
                  <div className="px-4 py-3 bg-white dark:bg-ink-800 space-y-1">
                    {/* Upcoming Event tag */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-brand-green/10 text-brand-green animate-pulse">
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-green opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-green" />
                      </span>
                      UPCOMING EVENT
                    </span>
                    {activePromo.tournament_name && (
                      <p className="text-sm font-bold text-ink-900 dark:text-white">{activePromo.tournament_name}</p>
                    )}
                    {activePromo.team1_name && activePromo.team2_name && (
                      <p className="text-xs text-ink-500 dark:text-ink-400">
                        {activePromo.team1_name}
                        {activePromo.captain1_name ? ` (C: ${activePromo.captain1_name})` : ''}
                        {' vs '}
                        {activePromo.team2_name}
                        {activePromo.captain2_name ? ` (C: ${activePromo.captain2_name})` : ''}
                      </p>
                    )}
                    {activePromo.event_date && (
                      <p className="text-xs text-ink-400">
                        {new Date(activePromo.event_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Quick Stats Strip */}
          <section>
            <div className="grid grid-cols-2 gap-2.5">
              <StatPill icon={<Swords size={15} className="text-brand-green" />} label="Matches" value={matches.length} />
              <StatPill icon={<Users size={15} className="text-brand-teal" />} label="Players" value={allStats.length || '—'} />
              <StatPill
                icon={<BarChart2 size={15} className="text-amber-500" />}
                label="Top Scorer"
                value={topScorer ? topScorer.bat_runs : '—'}
                sub={topScorer?.players?.name ?? null}
                onClick={topScorer?.players?.id ? () => navigate(`/players/${topScorer.players.id}`) : undefined}
              />
              <StatPill
                icon={<Zap size={15} className="text-purple-500" />}
                label="Top Wickets"
                value={topWickets ? topWickets.bowl_wickets : '—'}
                sub={topWickets?.players?.name ?? null}
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
                      {activeTournament.tournament_teams?.[0]?.count > 0 ? ` · ${activeTournament.tournament_teams[0].count} teams` : ''}
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
                <button onClick={() => navigate('/matches')} className="text-xs text-brand-green font-medium">
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
              <div className="space-y-3">
                {recent.map(m => (
                  <MatchScoreCard
                    key={m.id}
                    match={m}
                    matchNumber={matches.indexOf(m) + 1}
                    stats={matchStats[m.id]}
                    onDelete={canScore ? setToDelete : undefined}
                    onNavigate={id => navigate(`/matches/${id}/summary`)}
                  />
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

// ── Rich match card — Google-style with scores + top performers ─────────────

export function MatchScoreCard({ match, matchNumber, stats, onDelete, onNavigate }) {
  const { canScore } = useRole();

  const innings = stats?.innings || [];
  const cardMap = stats?.cardMap || {};

  // Innings by batting team (works regardless of who batted first)
  const team1BatInn = innings.find(i => i.batting_team === 1);
  const team2BatInn = innings.find(i => i.batting_team === 2);

  // Top 2 batters per team (from the innings they batted in)
  const team1Batters = team1BatInn
    ? (cardMap[team1BatInn.id]?.batting || []).slice().sort((a, b) => (b.runs || 0) - (a.runs || 0)).slice(0, 2)
    : [];
  const team2Batters = team2BatInn
    ? (cardMap[team2BatInn.id]?.batting || []).slice().sort((a, b) => (b.runs || 0) - (a.runs || 0)).slice(0, 2)
    : [];

  // Top bowler per team (from the innings they bowled in)
  const team1TopBowl = team2BatInn
    ? (cardMap[team2BatInn.id]?.bowling || []).slice().sort((a, b) => (b.wickets || 0) - (a.wickets || 0) || (a.runs_conceded || 0) - (b.runs_conceded || 0))[0]
    : null;
  const team2TopBowl = team1BatInn
    ? (cardMap[team1BatInn.id]?.bowling || []).slice().sort((a, b) => (b.wickets || 0) - (a.wickets || 0) || (a.runs_conceded || 0) - (b.runs_conceded || 0))[0]
    : null;

  const hasPerformers = team1Batters.length > 0 || team2Batters.length > 0;

  return (
    <div className="card overflow-hidden">
      {/* Clickable score header */}
      <button
        className="w-full text-left px-4 pt-4 pb-3"
        onClick={() => onNavigate(match.id)}
      >
        {matchNumber != null && (
          <p className="text-[10px] font-semibold tracking-widest text-ink-400 uppercase mb-2">
            Match {String(matchNumber).padStart(2, '0')}
            {match.tournaments?.name ? ` · ${match.tournaments.name}` : ''}
          </p>
        )}
        <div className="grid grid-cols-3 gap-1 items-center">
          {/* Team 1 */}
          <div>
            <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wide truncate mb-1">{match.team1_name}</p>
            <p className="text-2xl font-bold text-ink-900 dark:text-white leading-none">
              {team1BatInn ? `${team1BatInn.total_runs}/${team1BatInn.total_wickets}` : '—'}
            </p>
            {team1BatInn && (
              <p className="text-[11px] text-ink-400 mt-0.5">({formatOvers(team1BatInn.total_legal_balls)} ov)</p>
            )}
          </div>

          {/* Result */}
          <div className="text-center px-1">
            <p className="text-[11px] font-semibold text-ink-500 dark:text-ink-400 leading-tight">
              {match.result_summary || '—'}
            </p>
          </div>

          {/* Team 2 */}
          <div className="text-right">
            <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wide truncate mb-1">{match.team2_name}</p>
            <p className="text-2xl font-bold text-ink-900 dark:text-white leading-none">
              {team2BatInn ? `${team2BatInn.total_runs}/${team2BatInn.total_wickets}` : '—'}
            </p>
            {team2BatInn && (
              <p className="text-[11px] text-ink-400 mt-0.5">({formatOvers(team2BatInn.total_legal_balls)} ov)</p>
            )}
          </div>
        </div>
      </button>

      {/* Top performers */}
      {hasPerformers && (
        <div
          className="border-t border-ink-100 dark:border-white/10 px-4 py-3 grid grid-cols-2 gap-x-4 bg-ink-50/60 dark:bg-white/3 cursor-pointer"
          onClick={() => onNavigate(match.id)}
        >
          {/* Team 1 performers */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-1">{match.team1_name}</p>
            {team1Batters.map(b => (
              <div key={b.player_id} className="flex items-center gap-1.5">
                <PlayerAvatar name={b.players?.name || ''} size={20} />
                <span className="text-xs text-ink-700 dark:text-ink-200 truncate flex-1">{b.players?.name || '—'}</span>
                <span className="text-xs font-bold text-ink-900 dark:text-white tabular-nums">{b.runs ?? '—'}</span>
              </div>
            ))}
            {team1TopBowl && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <PlayerAvatar name={team1TopBowl.players?.name || ''} size={20} />
                <span className="text-xs text-ink-700 dark:text-ink-200 truncate flex-1">{team1TopBowl.players?.name || '—'}</span>
                <span className="text-xs font-bold text-brand-green tabular-nums">
                  {team1TopBowl.wickets}/{team1TopBowl.runs_conceded || 0}
                </span>
              </div>
            )}
          </div>

          {/* Team 2 performers */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wide mb-1">{match.team2_name}</p>
            {team2Batters.map(b => (
              <div key={b.player_id} className="flex items-center gap-1.5">
                <PlayerAvatar name={b.players?.name || ''} size={20} />
                <span className="text-xs text-ink-700 dark:text-ink-200 truncate flex-1">{b.players?.name || '—'}</span>
                <span className="text-xs font-bold text-ink-900 dark:text-white tabular-nums">{b.runs ?? '—'}</span>
              </div>
            ))}
            {team2TopBowl && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <PlayerAvatar name={team2TopBowl.players?.name || ''} size={20} />
                <span className="text-xs text-ink-700 dark:text-ink-200 truncate flex-1">{team2TopBowl.players?.name || '—'}</span>
                <span className="text-xs font-bold text-brand-green tabular-nums">
                  {team2TopBowl.wickets}/{team2TopBowl.runs_conceded || 0}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-ink-100 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-400">
            {matchDateValue(match) && format(matchDateValue(match), 'dd MMM yyyy')}
          </span>
          {match.venues?.name && (
            <span className="text-[11px] text-ink-300">· {match.venues.name}</span>
          )}
        </div>
        {onDelete && canScore && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(match); }}
            aria-label="Delete match"
            className="p-1.5 rounded-full text-ink-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

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
