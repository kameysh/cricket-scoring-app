import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Swords, Trash2, ArrowLeftRight, Trophy, ChevronDown } from 'lucide-react';
import * as matchService from '../services/matchService';
import MatchCard from '../components/match/MatchCard';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { useRole } from '../hooks/useRole';

const DONE_STATUSES = ['completed', 'no_result', 'abandoned'];

// Collapsible group of matches belonging to one tournament
function TournamentSection({ name, matches, onDelete }) {
  const completed = matches.filter(m => DONE_STATUSES.includes(m.status)).length;
  const live = matches.some(m => m.status === 'live' || m.status === 'paused');
  const allDone = completed === matches.length;
  // Finished tournaments collapse by default (tidy); active ones stay open for quick access.
  const [open, setOpen] = useState(!allDone);
  return (
    <div className="rounded-2xl border border-ink-100 dark:border-white/10 overflow-hidden bg-white dark:bg-ink-900/40">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-brand-green/10 flex items-center justify-center shrink-0">
          <Trophy size={17} className="text-brand-green" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-bold text-sm text-ink-900 dark:text-white truncate">{name}</p>
          <p className="text-[11px] text-ink-400 flex items-center gap-1.5">
            {matches.length} match{matches.length !== 1 ? 'es' : ''} · {completed} completed
            {live && <span className="inline-flex items-center gap-1 text-brand-green font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />Live</span>}
          </p>
        </div>
        <ChevronDown size={18} className={`text-ink-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-2">
          {matches.map((m, i) => <MatchCard key={m.id} match={m} matchNumber={i + 1} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

export default function Matches() {
  const navigate = useNavigate();
  const { canScore, isAdmin } = useRole();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => { matchService.listMatches().then(setMatches).finally(() => setLoading(false)); }, []);

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

  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      await matchService.deleteAllMatches();
      setMatches([]);
      toast.success('All matches deleted');
    } catch (e) {
      toast.error(e.message || 'Failed to delete matches');
    } finally {
      setDeletingAll(false);
      setDeleteAllOpen(false);
    }
  }

  const liveCount = matches.filter(m => m.status === 'live').length;

  // Group tournament matches under a collapsible section (by tournament); keep
  // standalone matches inline. A section appears at the position of its first match.
  const sections = useMemo(() => {
    const byTour = new Map(); // tournament_id -> section object (also pushed into result)
    const result = [];
    let globalNo = 0;
    for (const m of matches) {
      globalNo += 1;
      if (m.tournament_id) {
        let section = byTour.get(m.tournament_id);
        if (!section) {
          section = { type: 'tournament', id: m.tournament_id, name: m.tournaments?.name || 'Tournament', matches: [] };
          byTour.set(m.tournament_id, section);
          result.push(section);
        }
        section.matches.push(m);
      } else {
        result.push({ type: 'single', match: m, number: globalNo });
      }
    }
    return result;
  }, [matches]);

  return (
    <div className="p-4 space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Matches</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/h2h')}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-ink-100 dark:bg-white/10 text-ink-700 dark:text-ink-200">
            <ArrowLeftRight size={14} /> Compare
          </button>
          {isAdmin && matches.length > 0 && (
            <button onClick={() => setDeleteAllOpen(true)} title="Delete all matches"
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <Trash2 size={17} />
            </button>
          )}
          {canScore && (
            <button onClick={() => navigate('/matches/new')} className="btn-primary !py-1.5 !px-4 flex items-center gap-1.5 text-sm">
              <Plus size={16} /> New
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : matches.length === 0 ? (
        <EmptyState icon={Swords} title="No matches yet" message="Set up your first match." />
      ) : (
        <div className="space-y-2">
          {sections.map(s =>
            s.type === 'tournament'
              ? <TournamentSection key={s.id} name={s.name} matches={s.matches} onDelete={setToDelete} />
              : <MatchCard key={s.match.id} match={s.match} matchNumber={s.number} onDelete={setToDelete} />
          )}
        </div>
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

      <ConfirmDialog
        open={deleteAllOpen}
        title="Delete all matches?"
        message={`This will permanently delete all ${matches.length} match${matches.length !== 1 ? 'es' : ''}${liveCount > 0 ? ` (${liveCount} live match${liveCount !== 1 ? 'es' : ''} will be skipped)` : ''}, including all deliveries and scorecards. This cannot be undone.`}
        confirmLabel={deletingAll ? 'Deleting…' : 'Delete All'}
        danger
        onConfirm={handleDeleteAll}
        onCancel={() => setDeleteAllOpen(false)}
      />
    </div>
  );
}
