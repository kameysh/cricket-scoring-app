import { useState } from 'react';
import { createPortal } from 'react-dom';
import UndoButton from './UndoButton';

const RUN_BUTTONS = [0, 1, 2, 3, 4, 6];
const EXTRA_BUTTONS = [
  { key: 'wide', label: 'Wide' },
  { key: 'no_ball', label: 'No Ball' },
  { key: 'bye', label: 'Bye' },
  { key: 'leg_bye', label: 'Leg Bye' },
  { key: 'penalty_batting', label: 'Penalty' },
];

// Monochrome by default; color is reserved for the two boundary values so they pop at a glance.
function runButtonClass(r) {
  if (r === 4) return 'bg-gradient-to-br from-brand-green to-brand-teal text-white';
  if (r === 6) return 'bg-gradient-to-br from-brand-teal to-brand-blue text-white';
  return 'bg-ink-900 dark:bg-white text-white dark:text-ink-900';
}

export default function BallInputPanel({ onRuns, onExtra, onWicket, onUndo, undoDisabled }) {
  const [extraSheet, setExtraSheet] = useState(null);

  function openExtra(key) {
    if (key === 'penalty_batting') {
      onExtra(key, 5);
      return;
    }
    setExtraSheet(key);
  }

  function selectExtraRuns(n) {
    const key = extraSheet;
    setExtraSheet(null);
    onExtra(key, n);
  }

  return (
    <div className="p-3 bg-white dark:bg-ink-900 border-t border-ink-100 dark:border-white/5 space-y-2">
      <div className="grid grid-cols-6 gap-1.5">
        {RUN_BUTTONS.map(r => (
          <button
            key={r}
            onClick={() => onRuns(r)}
            className={`h-11 rounded-xl font-bold text-base active:scale-95 transition-transform ${runButtonClass(r)}`}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {EXTRA_BUTTONS.map(e => (
          <button
            key={e.key}
            onClick={() => openExtra(e.key)}
            className="h-9 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-semibold active:scale-95 transition-transform border border-amber-200 dark:border-amber-500/20"
          >
            {e.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button onClick={onWicket} className="h-11 rounded-xl bg-red-600 text-white font-bold text-sm active:scale-95 transition-transform">
          WICKET
        </button>
        <UndoButton disabled={undoDisabled} onClick={onUndo} />
      </div>

      {extraSheet && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setExtraSheet(null)}>
          <div className="bg-white dark:bg-ink-800 w-full rounded-t-3xl px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold mb-3 capitalize text-ink-900 dark:text-white">{extraSheet.replace('_', ' ')} — select runs</h4>
            <div className="grid grid-cols-6 gap-2">
              {[0, 1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => selectExtraRuns(n)}
                  className="min-h-[52px] rounded-xl font-bold text-base bg-ink-900 dark:bg-white text-white dark:text-ink-900 active:scale-95 transition-transform"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
