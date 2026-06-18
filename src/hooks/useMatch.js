import { useEffect } from 'react';
import { useMatchStore } from '../stores/matchStore';

export function useMatch(matchId) {
  const loadMatch = useMatchStore(s => s.loadMatch);
  const reset = useMatchStore(s => s.reset);
  const state = useMatchStore();

  useEffect(() => {
    if (matchId) loadMatch(matchId);
    return () => reset();
  }, [matchId]);

  return state;
}
