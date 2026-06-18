import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trophy } from 'lucide-react';
import { useTournamentStore } from '../stores/tournamentStore';
import TournamentCard from '../components/tournament/TournamentCard';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';

import { useRole } from '../hooks/useRole';

export default function Tournaments() {
  const navigate = useNavigate();
  const { tournaments, loading, fetchTournaments } = useTournamentStore();
  const { canManageTournaments } = useRole();

  useEffect(() => { fetchTournaments(); }, []);

  return (
    <div className="p-4 space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tournaments</h1>
        {canManageTournaments && (
          <button onClick={() => navigate('/tournaments/new')} className="btn-chip">
            <Plus size={16} /> Create
          </button>
        )}
      </div>
      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : tournaments.length === 0 ? (
        <EmptyState icon={Trophy} title="No tournaments yet" message="Create a league, knockout, or friendly series." />
      ) : (
        <div className="space-y-2">{tournaments.map(t => <TournamentCard key={t.id} tournament={t} />)}</div>
      )}
    </div>
  );
}
