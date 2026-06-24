import { useState } from 'react';
import { Repeat, LogOut } from 'lucide-react';
import PlayerLink from '../player/PlayerLink';
import { calcStrikeRate, fmt } from '../../lib/cricketUtils';

function BatsmanRow({ playerId, name, isStriker, card, onRetire }) {
  const [expanded, setExpanded] = useState(false);
  const runs = card?.runs || 0;
  const balls = card?.balls_faced || 0;
  return (
    <div className="border-b border-ink-50 dark:border-white/5 last:border-0 pb-1.5 last:pb-0 mb-1.5 last:mb-0">
      <div className="flex items-center justify-between">
        <div onClick={() => setExpanded(e => !e)} className="flex items-center gap-1.5 text-sm flex-1 text-left py-1 cursor-pointer select-none">
          {isStriker && <span className="text-cricket-gold text-[10px]">●</span>}
          <PlayerLink id={playerId} name={name} liveScoring />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-ink-700 dark:text-ink-200">
            {runs}({balls})
            {isStriker && balls > 0 && <span className="text-xs text-ink-400 ml-1">SR:{fmt(calcStrikeRate(runs, balls), 1)}</span>}
          </span>
          <button
            onClick={onRetire}
            title="Retire batsman"
            className="p-1 rounded-lg text-ink-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
      {expanded && card && (
        <div className="grid grid-cols-5 gap-1 text-center text-xs text-ink-400 pb-1 pl-3">
          <div>1s<br />{card.ones}</div>
          <div>2s<br />{card.twos}</div>
          <div>3s<br />{card.threes}</div>
          <div>4s<br />{card.fours}</div>
          <div>6s<br />{card.sixes}</div>
        </div>
      )}
    </div>
  );
}

export default function StrikerIndicator({ striker, nonStriker, strikerCard, nonStrikerCard, onSwap, onRetire }) {
  return (
    <div className="card p-3">
      <BatsmanRow
        playerId={striker?.id} name={striker?.name} isStriker
        card={strikerCard} onRetire={() => onRetire(striker?.id)}
      />
      {nonStriker && (
        <BatsmanRow
          playerId={nonStriker.id} name={nonStriker.name} isStriker={false}
          card={nonStrikerCard} onRetire={() => onRetire(nonStriker.id)}
        />
      )}
      {nonStriker && (
        <button onClick={onSwap} className="mt-1 flex items-center gap-1 text-xs text-cricket-green dark:text-cricket-gold">
          <Repeat size={12} /> Swap ends
        </button>
      )}
    </div>
  );
}
