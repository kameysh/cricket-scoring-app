import { useNavigate } from 'react-router-dom';
import PlayerAvatar from './PlayerAvatar';
import { Star } from 'lucide-react';

export default function PlayerCard({ player, isJoker = false }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/players/${player.id}`)}
      className="w-full flex items-center gap-3 p-3 card hover:shadow-md transition-shadow text-left"
    >
      <PlayerAvatar name={player.name} photoUrl={player.photo_url} size={44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-900 dark:text-white truncate">{player.name}</span>
          {isJoker && <Star size={14} className="text-cricket-gold fill-cricket-gold" />}
          {!player.is_active && <span className="text-xs text-gray-400">(inactive)</span>}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {[player.batting_style, player.bowling_style].filter(Boolean).join(' · ') || 'No style set'}
        </p>
      </div>
    </button>
  );
}
