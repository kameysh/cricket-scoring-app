import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import * as matchService from '../services/matchService';
import MatchCard from '../components/match/MatchCard';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { Swords } from 'lucide-react';
import { useRole } from '../hooks/useRole';

export default function Home() {
  const navigate = useNavigate();
  const { canScore } = useRole();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => {
    matchService.listMatches().then(setMatches).finally(() => setLoading(false));
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
  const recent = matches.filter(m => m.status === 'completed').slice(0, 5);

  return (
    <div className="p-4 space-y-6 page-transition">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Cricket Scorer</h1>
        {canScore && (
          <button onClick={() => navigate('/matches/new')} className="btn-chip">
            <Plus size={16} /> New Match
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <>
          {live.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 mb-2">Live Now</h2>
              <div className="space-y-2">{live.map(m => <MatchCard key={m.id} match={m} onDelete={setToDelete} />)}</div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">Recent Matches</h2>
            {recent.length === 0 ? (
              <EmptyState icon={Swords} title="No matches yet" message="Start your first match to begin scoring." />
            ) : (
              <div className="space-y-2">{recent.map(m => <MatchCard key={m.id} match={m} onDelete={setToDelete} />)}</div>
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
