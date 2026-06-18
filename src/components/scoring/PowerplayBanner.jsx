export default function PowerplayBanner({ match, innings }) {
  if (!match.powerplay_start || !match.powerplay_end) return null;
  const currentOver = Math.floor(innings.total_legal_balls / 6) + 1;
  const active = currentOver >= match.powerplay_start && currentOver <= match.powerplay_end;
  if (!active) return null;
  return (
    <div className="bg-amber-400 text-amber-900 text-center text-sm font-semibold py-1.5">
      ⚡ Powerplay — overs {match.powerplay_start}-{match.powerplay_end}
    </div>
  );
}
