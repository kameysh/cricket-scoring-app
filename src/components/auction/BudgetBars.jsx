export default function BudgetBars({ teams, budgetPerTeam }) {
  if (!teams?.length) return null;
  return (
    <div className="card px-4 py-3 space-y-2">
      {teams.map(t => {
        const pct = budgetPerTeam > 0 ? Math.max(0, (t.budget_remaining / budgetPerTeam) * 100) : 0;
        const isLow = pct < 20;
        return (
          <div key={t.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-ink-700 dark:text-ink-200">{t.name ?? '—'}</span>
              <span className="text-xs tabular-nums text-ink-500 dark:text-ink-400">
                ₹{t.budget_remaining.toLocaleString()} left · {t.players_bought} bought
              </span>
            </div>
            <div className="h-2 rounded-full bg-ink-100 dark:bg-white/10 overflow-hidden">
              <div
                data-testid={`budget-bar-${t.id}`}
                className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-400' : 'bg-brand-green'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
