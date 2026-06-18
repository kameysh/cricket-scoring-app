import { useMatchStore } from '../stores/matchStore';

export function useJoker() {
  const match = useMatchStore(s => s.match);
  const striker = useMatchStore(s => s.striker);
  const nonStriker = useMatchStore(s => s.nonStriker);
  const bowler = useMatchStore(s => s.bowler);
  const jokerId = match?.joker_player_id;
  return {
    jokerId,
    isBatting: jokerId && (jokerId === striker || jokerId === nonStriker),
    isBowling: jokerId && jokerId === bowler,
  };
}
