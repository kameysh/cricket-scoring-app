function CaptainAvatar({ player, teamName }) {
  if (player?.photo_url) {
    return (
      <img
        src={player.photo_url}
        alt={player.name}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0 border-2 border-white dark:border-ink-700 shadow-sm"
      />
    );
  }
  const initials = (player?.name || teamName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full flex-shrink-0 bg-brand-green/20 flex items-center justify-center border-2 border-white dark:border-ink-700 shadow-sm">
      <span className="text-[10px] font-bold text-brand-green">{initials}</span>
    </div>
  );
}

export default function BudgetBars({ teams, budgetPerTeam }) {
  if (!teams?.length) return null;
  return (
    <div className="card px-4 py-3 space-y-2">
      {teams.map(t => {
        const pct = budgetPerTeam > 0 ? Math.max(0, (t.budget_remaining / budgetPerTeam) * 100) : 0;
        const isLow = pct < 20;
        return (
          <div key={t.id}>
            <div className="flex items-center justify-between mb-1 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CaptainAvatar player={t.captainPlayer} teamName={t.name} />
                <span className="text-xs font-semibold text-ink-700 dark:text-ink-200 truncate">{t.name ?? '—'}</span>
              </div>
              <span className="text-xs tabular-nums text-ink-500 dark:text-ink-400 flex-shrink-0">
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
