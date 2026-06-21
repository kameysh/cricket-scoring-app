import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Repeat2, Trophy, Calendar } from 'lucide-react';
import * as seriesService from '../services/seriesService';
import TournamentLeaderboard from '../components/tournament/TournamentLeaderboard';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import toast from 'react-hot-toast';

function statusBadge(status) {
  if (status === 'completed') return 'bg-ink-100 text-ink-500 dark:bg-white/10 dark:text-ink-400';
  if (status === 'ongoing') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
}

export default function SeriesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [series, setSeries] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      seriesService.getSeries(id),
      seriesService.getSeriesTournaments(id),
      seriesService.getSeriesPlayerStats(id),
    ]).then(([s, t, st]) => {
      setSeries(s);
      setTournaments(t);
      setStats(st);
    }).catch(() => toast.error('Failed to load series'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-4"><LoadingSkeleton rows={5} /></div>;
  if (!series) return <div className="p-4 text-center text-ink-400">Series not found.</div>;

  return (
    <div className="p-4 space-y-5 page-transition">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Repeat2 size={16} className="text-brand-green shrink-0" />
            <h1 className="text-xl font-bold text-ink-900 dark:text-white truncate">{series.name}</h1>
          </div>
          <p className="text-xs text-ink-400 mt-0.5">{tournaments.length} season{tournaments.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Seasons list */}
      {tournaments.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Seasons</h2>
          <div className="space-y-2">
            {tournaments.map((t, i) => (
              <Link
                key={t.id}
                to={`/tournaments/${t.id}`}
                className="card p-3 flex items-center gap-3 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-green/20 to-brand-teal/20 dark:from-brand-green/10 dark:to-brand-teal/10 flex items-center justify-center shrink-0">
                  <Trophy size={16} className="text-brand-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{t.name}</p>
                  {t.start_date && (
                    <p className="text-xs text-ink-400 flex items-center gap-1 mt-0.5">
                      <Calendar size={10} />
                      {new Date(t.start_date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${statusBadge(t.status)}`}>
                  {t.status || 'upcoming'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Aggregated stats */}
      <section>
        <h2 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Series Stats — All Seasons</h2>
        {stats.length === 0 ? (
          <div className="card p-6 text-center text-ink-400 text-sm">
            No stats yet. Stats appear once matches are played across seasons.
          </div>
        ) : (
          <TournamentLeaderboard batting={stats} bowling={stats} fielding={stats} />
        )}
      </section>
    </div>
  );
}
