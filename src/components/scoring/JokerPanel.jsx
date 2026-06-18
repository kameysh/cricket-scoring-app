import { useState } from 'react';
import { Star } from 'lucide-react';
import PlayerLink from '../player/PlayerLink';

export default function JokerPanel({ joker, isBatting, isBowling, onCallToBat, onCallToBowl }) {
  const [expanded, setExpanded] = useState(false);
  if (!joker) return null;

  return (
    <div className="bg-cricket-gold/10 border border-cricket-gold/40 rounded-xl p-3">
      <div onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between cursor-pointer select-none">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Star size={14} className="text-cricket-gold fill-cricket-gold" />
          Joker: <PlayerLink id={joker.id} name={joker.name} liveScoring />
        </span>
        <span className="text-xs text-gray-500">
          {isBatting ? 'Batting' : isBowling ? 'Bowling' : 'Available'}
        </span>
      </div>
      {expanded && (
        <div className="mt-2 flex gap-2">
          {!isBatting && (
            <button onClick={onCallToBat} className="flex-1 py-2 rounded-lg bg-cricket-gold text-white text-xs font-semibold">
              Call to Bat
            </button>
          )}
          {!isBowling && (
            <button onClick={onCallToBowl} className="flex-1 py-2 rounded-lg bg-cricket-gold text-white text-xs font-semibold">
              Call to Bowl
            </button>
          )}
        </div>
      )}
    </div>
  );
}
