export default function PassIndicator({ passTeam1, passTeam2, teamNames }) {
  if (!passTeam1 && !passTeam2) return null;
  return (
    <div data-testid="pass-indicator" className="flex gap-2 justify-center">
      {[passTeam1, passTeam2].map((passing, i) => (
        <span
          key={i}
          className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors ${
            passing
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
              : 'bg-ink-100 text-ink-400 dark:bg-white/5 dark:text-ink-500'
          }`}
        >
          {teamNames?.[i] ?? `Team ${i + 1}`}: {passing ? 'Passing' : 'Bidding'}
        </span>
      ))}
    </div>
  );
}
