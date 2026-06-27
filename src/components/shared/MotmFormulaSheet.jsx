import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';

// Mirrors calcMotmScore() in src/lib/cricketUtils.js — the same formula powers
// Man of the Match (per match) and Man of the Series (summed across the series).
const SECTIONS = [
  {
    title: 'Batting',
    rows: [
      { icon: '🏏', label: 'Run scored',     pts: '+1 pt each',        note: 'every run counts' },
      { icon: '4️⃣', label: 'Four hit',       pts: '+1 pt each',        note: 'boundary bonus' },
      { icon: '6️⃣', label: 'Six hit',        pts: '+2 pts each',       note: 'big-hit bonus' },
      { icon: '🎯', label: '30+ score',      pts: '+5 pts',            note: '30–49 in an innings' },
      { icon: '⭐', label: 'Half-century',   pts: '+15 pts',           note: '50–99 in an innings' },
      { icon: '💯', label: 'Century',        pts: '+30 pts',           note: '100+ in an innings' },
      { icon: '⚡', label: 'Strike rate',    pts: '+6 → +20',          note: 'min 6 balls · ≥125 / ≥150 / ≥200' },
      { icon: '🛡️', label: 'Not out',        pts: '+5 pts',            note: 'if 10+ runs' },
      { icon: '🦆', label: 'Duck',           pts: '−5 pts',            note: 'out for 0' },
    ],
  },
  {
    title: 'Bowling',
    rows: [
      { icon: '🎳', label: 'Wicket taken',   pts: '+25 pts each',      note: 'the biggest reward' },
      { icon: '🧱', label: 'Maiden over',    pts: '+6 pts each',       note: 'no runs conceded' },
      { icon: '🔥', label: '3-wicket haul',  pts: '+10 pts',           note: '3–4 wickets' },
      { icon: '🌟', label: '5-wicket haul',  pts: '+20 pts',           note: '5+ wickets' },
      { icon: '🪙', label: 'Economy',        pts: '+5 → +15',          note: 'min 6 balls · ≤8 / ≤6 / ≤5' },
    ],
  },
  {
    title: 'Fielding',
    rows: [
      { icon: '🧤', label: 'Catch',          pts: '+8 pts each',       note: 'fielding credit' },
      { icon: '🥅', label: 'Stumping',       pts: '+10 pts each',      note: 'keeper credit' },
      { icon: '🏃', label: 'Run out',        pts: '+8 pts each',       note: 'direct or assisted' },
    ],
  },
];

/**
 * Formula explainer for the impact-score that drives Man of the Match / Man of the Series.
 * Props:
 *   title    – heading (default "Man of the Series Formula")
 *   footer   – explanatory line shown at the bottom
 *   onClose  – () => void
 */
export default function MotmFormulaSheet({
  title = 'Man of the Series Formula',
  footer = 'Scored per innings and summed across every match in the series. The player with the highest total wins Man of the Series.',
  onClose,
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ink-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-cricket-gold to-amber-500 px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-white/80" />
                <span className="text-white/80 text-xs font-semibold uppercase tracking-widest">How it works</span>
              </div>
              <h2 className="text-white text-lg font-bold leading-tight">{title}</h2>
              <p className="text-white/80 text-xs mt-1">Every contribution earns impact points. The player with the highest total takes the award.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors shrink-0 mt-0.5"
            >
              <X size={14} className="text-white" />
            </button>
          </div>
        </div>

        {/* Formula rows */}
        <div className="px-5 py-4 overflow-y-auto">
          {SECTIONS.map(section => (
            <div key={section.title} className="mb-3 last:mb-0">
              <p className="text-[11px] font-bold text-ink-400 uppercase tracking-widest mb-1">{section.title}</p>
              {section.rows.map(row => (
                <div key={row.label} className="flex items-center gap-3 py-1.5 border-b border-ink-50 dark:border-white/5 last:border-0">
                  <span className="text-lg w-7 text-center shrink-0">{row.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ink-900 dark:text-white">{row.label}</p>
                    <p className="text-[11px] text-ink-400">{row.note}</p>
                  </div>
                  <span className="text-xs font-bold text-cricket-gold whitespace-nowrap">{row.pts}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 shrink-0">
          <div className="bg-ink-50 dark:bg-white/5 rounded-xl px-4 py-3">
            <p className="text-[11px] text-ink-500 dark:text-ink-400 text-center leading-relaxed">{footer}</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
