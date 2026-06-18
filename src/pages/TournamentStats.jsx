import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as tournamentService from '../services/tournamentService';
import TournamentLeaderboard from '../components/tournament/TournamentLeaderboard';

export default function TournamentStats() {
  const { id } = useParams();
  const [batting, setBatting] = useState([]);
  const [bowling, setBowling] = useState([]);
  const [fielding, setFielding] = useState([]);

  useEffect(() => {
    tournamentService.getLeaderboard(id, 'batting').then(setBatting);
    tournamentService.getLeaderboard(id, 'bowling').then(setBowling);
    tournamentService.getLeaderboard(id, 'fielding').then(setFielding);
  }, [id]);

  return (
    <div className="p-4 page-transition">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Leaderboard</h1>
      <TournamentLeaderboard batting={batting} bowling={bowling} fielding={fielding} />
    </div>
  );
}
