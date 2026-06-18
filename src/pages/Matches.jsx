import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Swords, Trash2 } from 'lucide-react';
import * as matchService from '../services/matchService';
import MatchCard from '../components/match/MatchCard';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { useRole } from '../hooks/useRole';

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

  return (
    <div className="p-4 space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Matches</h1>
        <div className="flex items-center gap-2">
          {isAdmin && matches.length > 0 && (
            <button
              onClick={() => setDeleteAllOpen(true)}
              className="btn-chip !text-red-500 !border-red-200 dark:!border-red-800 hover:!bg-red-50 dark:hover:!bg-red-500/10"
            >
              <Trash2 size={14} /> Delete All
            </button>
          )}
          {canScore && (
            <button onClick={() => navigate('/matches/new')} className="btn-chip">
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
        <div className="space-y-2">{matches.map(m => <MatchCard key={m.id} match={m} onDelete={setToDelete} />)}</div>
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
