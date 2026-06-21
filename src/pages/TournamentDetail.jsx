import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BarChart3, Pencil, Trophy, Repeat2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as tournamentService from '../services/tournamentService';
import * as matchService from '../services/matchService';
import PointsTable from '../components/tournament/PointsTable';
import FixtureList from '../components/tournament/FixtureList';
import KnockoutBracket from '../components/tournament/KnockoutBracket';
import BottomSheet from '../components/shared/BottomSheet';
import { useRole } from '../hooks/useRole';

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const formatBadgeColor = {
  league: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  knockout: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  friendly: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
};

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canScore, canManageTournaments } = useRole();

  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [points, setPoints] = useState([]);
  const [teams, setTeams] = useState([]);

  const [completing, setCompleting] = useState(false);

  // Toss sheet state
  const [startMatchId, setStartMatchId] = useState(null);
  const [tossWinner, setTossWinner] = useState('');
  const [tossDecision, setTossDecision] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    tournamentService.getTournament(id).then(setTournament);
    tournamentService.getTournamentMatches(id).then(setMatches);
    tournamentService.getPointsTable(id).then(setPoints);
    tournamentService.getTournamentTeams(id).then(setTeams);
  }, [id]);

  async function handleCompleteTournament() {
    setCompleting(true);
    try {
      await matchService.autoAssignManOfSeries(id);
      await tournamentService.updateTournament(id, { status: 'completed' });
      const fresh = await tournamentService.getTournament(id);
      setTournament(fresh);
      toast.success('Tournament completed — Man of Series assigned!');
    } catch (e) {
      toast.error(e.message || 'Failed to complete tournament');
    } finally {
      setCompleting(false);
    }
  }

  function openToss(matchId) {
    setStartMatchId(matchId);
    setTossWinner('');
    setTossDecision('');
  }

  async function handleStartMatch() {
    if (!tossWinner || !tossDecision) {
      toast.error('Select toss winner and decision');
      return;
    }
    setStarting(true);
    const matchIdToStart = startMatchId;
    try {
      await matchService.startUpcomingMatch(matchIdToStart, tossWinner, tossDecision);
      setStartMatchId(null);
      navigate(`/matches/${matchIdToStart}`);
    } catch (e) {
      toast.error(e.message || 'Failed to start match');
      setStarting(false);
    }
  }

  if (!tournament) return null;

  const dateRange = tournament.start_date
    ? `${formatDate(tournament.start_date)}${tournament.end_date ? ` – ${formatDate(tournament.end_date)}` : ''}`
    : null;

  // Find the match being started (for team names in toss sheet)
  const startMatch = matches.find(m => m.id === startMatchId);

  return (
    <div className="p-4 space-y-5 page-transition">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          {tournament.series && (
            <Link to={`/series/${tournament.series.id}`} className="flex items-center gap-1 text-xs text-brand-green font-medium mb-0.5">
              <Repeat2 size={11} />
              {tournament.series.name}
            </Link>
          )}
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{tournament.name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
              tournament.status === 'ongoing' ? 'bg-red-100 text-red-700' :
              tournament.status === 'completed' ? 'bg-green-100 text-green-700' :
              'bg-gray-100 text-gray-600'
            }`}>{tournament.status}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${formatBadgeColor[tournament.type]}`}>
              {tournament.type === 'league' ? 'League' : tournament.type === 'knockout' ? 'Knockout' : 'Friendly'}
            </span>
            {teams.length > 0 && (
              <span className="text-xs text-ink-500 dark:text-ink-300">{teams.length} Team{teams.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          {dateRange && <p className="text-xs text-ink-400">{dateRange}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to={`/tournaments/${id}/stats`} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600">
            <BarChart3 size={18} />
          </Link>
          {canManageTournaments && tournament.status !== 'completed' && matches.length > 0 && matches.every(m => m.status === 'completed') && (
            <button
              onClick={handleCompleteTournament}
              disabled={completing}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-brand-green text-white disabled:opacity-50"
            >
              {completing ? '…' : '✓ Complete'}
            </button>
          )}
          {canManageTournaments && (
            <Link to={`/tournaments/${id}/edit`} className="p-2 rounded-lg border border-gray-300 dark:border-gray-600">
              <Pencil size={18} />
            </Link>
          )}
        </div>
      </div>

      {/* Man of the Series */}
      {tournament.man_of_series && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-cricket-gold/10 border border-cricket-gold/30">
          <Trophy size={20} className="text-cricket-gold shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-cricket-gold uppercase tracking-wider">Man of the Series</p>
            <p className="font-bold text-ink-900 dark:text-white">{tournament.man_of_series.name}</p>
          </div>
        </div>
      )}

      {/* Setup banner — series not yet created */}
      {canManageTournaments && tournament.series_matches && matches.length === 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">⚠ Series matches not created yet</p>
          <Link to={`/tournaments/${id}/setup`} className="text-sm font-semibold text-amber-700 dark:text-amber-400 underline">
            Set up now →
          </Link>
        </div>
      )}

      {/* Teams */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Teams</h2>
        {teams.length === 0 ? (
          <p className="text-sm text-ink-400">
            No teams registered.{canManageTournaments && (
              <> <Link to={`/tournaments/${id}/edit`} className="text-brand-green underline">Edit tournament</Link> to add teams.</>
            )}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {teams.map(team => {
              const played = matches.filter(m => m.team1_name === team.name || m.team2_name === team.name).length;
              return (
                <div key={team.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-50 dark:bg-white/5 border border-ink-100 dark:border-white/10">
                  <span className="text-sm font-medium">{team.name}</span>
                  {played > 0 && <span className="text-xs text-ink-400">{played}M</span>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Series score card */}
      {tournament.series_matches && teams.length === 2 && (() => {
        const [t1, t2] = teams;
        const played = matches.filter(m => m.status === 'completed');
        const t1wins = played.filter(m => m.winning_team_name === t1.name).length;
        const t2wins = played.filter(m => m.winning_team_name === t2.name).length;
        const ties = played.filter(m => m.result_type === 'tie' || m.result_type === 'no_result').length;
        const toWin = Math.ceil(tournament.series_matches / 2);
        const winner = t1wins >= toWin ? t1.name : t2wins >= toWin ? t2.name : null;
        return (
          <section className="card p-4">
            <h2 className="text-xs font-semibold text-ink-400 mb-3 uppercase tracking-wide">
              {`Best of ${tournament.series_matches} Series`}
            </h2>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-ink-900 dark:text-white">{t1wins}</p>
                <p className="text-xs text-ink-500 mt-0.5 truncate">{t1.name}</p>
              </div>
              <div className="text-center space-y-0.5">
                {ties > 0 && <p className="text-xs text-ink-400">{ties} tied</p>}
                <p className="text-xs text-ink-400">{played.length} / {tournament.series_matches} played</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-ink-900 dark:text-white">{t2wins}</p>
                <p className="text-xs text-ink-500 mt-0.5 truncate">{t2.name}</p>
              </div>
            </div>
            {winner ? (
              <p className="text-center text-sm font-semibold text-brand-green mt-3">🏆 {winner} won the series</p>
            ) : t1wins > t2wins ? (
              <p className="text-center text-xs text-ink-500 mt-2">{t1.name} leads {t1wins}–{t2wins}</p>
            ) : t2wins > t1wins ? (
              <p className="text-center text-xs text-ink-500 mt-2">{t2.name} leads {t2wins}–{t1wins}</p>
            ) : played.length > 0 ? (
              <p className="text-center text-xs text-ink-500 mt-2">Series level {t1wins}–{t2wins}</p>
            ) : null}
          </section>
        );
      })()}

      {tournament.type === 'league' && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Points Table</h2>
          <PointsTable rows={points} />
        </section>
      )}

      {tournament.type === 'knockout' && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Bracket</h2>
          <KnockoutBracket matches={matches} />
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500">Fixtures</h2>
          {canScore && !tournament.series_matches && (
            <button onClick={() => navigate('/matches/new')} className="text-sm font-medium text-cricket-green dark:text-cricket-gold">+ New Match</button>
          )}
        </div>
        <FixtureList
          matches={matches}
          onStart={canScore ? openToss : null}
          seriesTotal={tournament.series_matches || undefined}
        />
      </section>

      {/* Toss bottom sheet */}
      <BottomSheet
        open={!!startMatchId}
        onClose={() => setStartMatchId(null)}
        title="Start Match — Toss"
        heightClass="h-auto"
      >
        {startMatch && (
          <div className="space-y-5 pb-2">
            <div>
              <p className="text-sm font-semibold mb-2">Who won the toss?</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'team1', label: startMatch.team1_name },
                  { value: 'team2', label: startMatch.team2_name },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTossWinner(opt.value)}
                    className={`py-3 rounded-xl border text-sm font-semibold transition-colors ${
                      tossWinner === opt.value
                        ? 'bg-brand-green text-white border-brand-green'
                        : 'border-ink-200 dark:border-white/10 text-ink-700 dark:text-ink-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Chose to…</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'bat', label: '🏏 Bat' },
                  { value: 'field', label: '🧤 Field' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTossDecision(opt.value)}
                    className={`py-3 rounded-xl border text-sm font-semibold transition-colors ${
                      tossDecision === opt.value
                        ? 'bg-brand-green text-white border-brand-green'
                        : 'border-ink-200 dark:border-white/10 text-ink-700 dark:text-ink-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartMatch}
              disabled={!tossWinner || !tossDecision || starting}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {starting ? 'Starting…' : '▶ Start Match'}
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
