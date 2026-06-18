import { useState, useEffect } from 'react';
import BottomSheet from '../shared/BottomSheet';

const ALL_TYPES = [
  { key: 'bowled', label: 'Bowled' },
  { key: 'caught', label: 'Caught', needsFielder: true },
  { key: 'lbw', label: 'LBW' },
  { key: 'run_out', label: 'Run Out', needsFielder: true },
  { key: 'stumped', label: 'Stumped', needsFielder: true },
  { key: 'hit_wicket', label: 'Hit Wicket' },
  { key: 'obstructing', label: 'Obstructing the Field' },
  { key: 'timed_out', label: 'Timed Out' },
  { key: 'handled_ball', label: 'Handled the Ball' },
  { key: 'retired_hurt', label: 'Retired Hurt' },
  { key: 'retired_out', label: 'Retired Out' },
];

const FREE_HIT_ALLOWED = ['run_out', 'hit_wicket', 'obstructing'];
const NO_BALL_ALLOWED = ['run_out'];

export default function WicketModal({ open, onClose, onConfirm, fielders, isFreeHit, isNoBall, batsmenOnField }) {
  const [type, setType] = useState(null);
  const [fielderId, setFielderId] = useState('');
  const [batsmanOutId, setBatsmanOutId] = useState(batsmenOnField?.[0]?.id || '');
  const [crossed, setCrossed] = useState(null);

  useEffect(() => {
    if (open) {
      setBatsmanOutId(batsmenOnField?.[0]?.id || '');
      setType(null);
      setFielderId('');
      setCrossed(null);
    }
  }, [open, batsmenOnField]);

  const types = ALL_TYPES.filter(t => {
    if (isFreeHit) return FREE_HIT_ALLOWED.includes(t.key);
    if (isNoBall) return NO_BALL_ALLOWED.includes(t.key) || ['retired_hurt', 'retired_out'].includes(t.key);
    return true;
  });

  const selected = types.find(t => t.key === type);

  function handleConfirm() {
    if (!type) return;
    if (selected?.needsFielder && !fielderId) return;
    if (type === 'run_out' && crossed === null && batsmenOnField?.length === 2) return;
    onConfirm({ wicketType: type, fielderId: fielderId || null, batsmanOutId: batsmanOutId || null, crossed });
    setType(null); setFielderId(''); setCrossed(null);
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Wicket" heightClass="h-[80vh]">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Dismissal type</p>
          <div className="grid grid-cols-2 gap-2">
            {types.map(t => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={`py-2.5 px-2 rounded-lg text-sm font-medium border ${type === t.key ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 dark:border-gray-600'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {batsmenOnField?.length === 2 && (
          <div>
            <p className="text-sm font-medium mb-1">Batsman out</p>
            <select value={batsmanOutId} onChange={e => setBatsmanOutId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800">
              {batsmenOnField.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        {selected?.needsFielder && (
          <div>
            <p className="text-sm font-medium mb-1">Fielder</p>
            <select value={fielderId} onChange={e => setFielderId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800">
              <option value="">Select fielder</option>
              {fielders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
        )}

        {type === 'run_out' && (
          <div>
            <p className="text-sm font-medium mb-1">Did batsmen cross?</p>
            <div className="flex gap-2">
              <button onClick={() => setCrossed(true)} className={`flex-1 py-2.5 rounded-lg border ${crossed === true ? 'bg-cricket-green text-white border-cricket-green' : 'border-gray-300'}`}>Yes</button>
              <button onClick={() => setCrossed(false)} className={`flex-1 py-2.5 rounded-lg border ${crossed === false ? 'bg-cricket-green text-white border-cricket-green' : 'border-gray-300'}`}>No</button>
            </div>
          </div>
        )}

        <button onClick={handleConfirm} disabled={!type} className="w-full py-3 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-40">
          Confirm Wicket
        </button>
      </div>
    </BottomSheet>
  );
}
