import { useMatchStore } from '../stores/matchStore';

export function useScoring() {
  const scoreBall = useMatchStore(s => s.scoreBall);
  const undo = useMatchStore(s => s.undo);
  const undoAvailable = useMatchStore(s => s.undoAvailable);
  return { scoreBall, undo, undoAvailable };
}
