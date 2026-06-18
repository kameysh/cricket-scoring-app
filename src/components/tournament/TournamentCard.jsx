import { useNavigate } from 'react-router-dom';

const statusColors = {
  upcoming: 'bg-gray-100 text-gray-700',
  ongoing: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

function formatShortDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TournamentCard({ tournament }) {
  const navigate = useNavigate();
  const teamCount = tournament.tournament_teams?.[0]?.count ?? null;

  return (
    <button onClick={() => navigate(`/tournaments/${tournament.id}`)} className="w-full text-left card p-4 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900 dark:text-white">{tournament.name}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[tournament.status]}`}>{tournament.status}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="capitalize">{tournament.type}</span>
        {tournament.venues?.name && <><span>·</span><span>{tournament.venues.name}</span></>}
        {teamCount !== null && teamCount > 0 && <><span>·</span><span>{teamCount} team{teamCount !== 1 ? 's' : ''}</span></>}
      </div>
      {tournament.start_date && (
        <p className="text-xs text-ink-400">
          {formatShortDate(tournament.start_date)}{tournament.end_date ? ` – ${formatShortDate(tournament.end_date)}` : ''}
        </p>
      )}
    </button>
  );
}
