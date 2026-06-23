// Displays player.name as primary text and player.nickname (if set) below in small text.
// Use this in any list row or card where space allows two lines.
// For single-line contexts (dropdowns, scorecard cols), use displayName() from cricketUtils instead.
export default function PlayerName({ player, className = '', nameClass = '', nickClass = '' }) {
  if (!player) return null;
  return (
    <span className={`flex flex-col min-w-0 ${className}`}>
      <span className={`font-semibold truncate leading-tight ${nameClass}`}>{player.name}</span>
      {player.nickname?.trim() && (
        <span className={`text-[11px] text-ink-400 dark:text-ink-500 truncate leading-tight ${nickClass}`}>
          "{player.nickname.trim()}"
        </span>
      )}
    </span>
  );
}
