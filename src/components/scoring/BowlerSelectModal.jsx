import { useEffect } from 'react';
import toast from 'react-hot-toast';
import BottomSheet from '../shared/BottomSheet';
import PlayerLink from '../player/PlayerLink';

export default function BowlerSelectModal({ open, onClose, eligible, onSelect, forcedBowler, title = 'Select Next Bowler' }) {
  useEffect(() => {
    if (open && eligible.length === 1) {
      onSelect(eligible[0].id);
      toast(`${eligible[0].name} auto-selected to bowl`, { icon: '🎯' });
    } else if (open && eligible.length === 0 && forcedBowler) {
      onSelect(forcedBowler.id);
      toast.error(`No eligible bowlers — ${forcedBowler.name} bowls again`);
    }
  }, [open, eligible, forcedBowler]);

  if (eligible.length <= 1 && (eligible.length === 1 || forcedBowler)) return null;

  return (
    <BottomSheet open={open} onClose={onClose} title={title} heightClass="h-[60vh]">
      <div className="space-y-1">
        {eligible.map(c => (
          <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <PlayerLink id={c.id} name={c.name} newTab />
            <button onClick={() => onSelect(c.id)} className="btn-chip !px-3 !py-1.5 text-xs">
              Bowl
            </button>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
