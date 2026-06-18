export default function TossSetup({ team1Name, team2Name, value, onChange }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="field-label">Toss winner</label>
        <div className="flex gap-2">
          {[['team1', team1Name], ['team2', team2Name]].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => onChange({ ...value, toss_winner: val })}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold border transition-all ${
                value.toss_winner === val ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 dark:border-white shadow-pill' : 'border-ink-200 dark:border-white/10 text-ink-600 dark:text-ink-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="field-label">Decision</label>
        <div className="flex gap-2">
          {[['bat', 'Bat'], ['field', 'Field']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => onChange({ ...value, toss_decision: val })}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold border transition-all ${
                value.toss_decision === val ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900 border-ink-900 dark:border-white shadow-pill' : 'border-ink-200 dark:border-white/10 text-ink-600 dark:text-ink-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
