import { useEffect, useState } from 'react';
import * as playerService from '../services/playerService';

export function usePlayerStats(playerId, tournamentId) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    const fetcher = tournamentId
      ? playerService.getTournamentStats(playerId, tournamentId)
      : playerService.getCareerStats(playerId);
    fetcher.then(setStats).finally(() => setLoading(false));
  }, [playerId, tournamentId]);

  return { stats, loading };
}
