import BottomSheet from '../shared/BottomSheet';
import PlayerLink from '../player/PlayerLink';

export default function NewBatsmanModal({ open, onClose, candidates, onSelect }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Select New Batsman" heightClass="h-[60vh]">
      <div className="space-y-1">
        {candidates.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No batsmen remaining — innings over</p>}
        {candidates.map(c => (
          <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <PlayerLink id={c.id} name={c.name} newTab />
            <button onClick={() => onSelect(c.id)} className="btn-chip !px-3 !py-1.5 text-xs">
              Send In
            </button>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
