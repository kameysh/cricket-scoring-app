export default function KnockoutBracket({ matches }) {
  if (!matches || matches.length === 0) return <p className="text-sm text-gray-400 text-center py-8">Bracket not generated yet</p>;
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {matches.map((m, i) => (
        <div key={m.id} className="min-w-[180px] card p-3">
          <div className="text-xs text-gray-400 mb-1">Match {i + 1}</div>
          <div className="text-sm font-medium">{m.team1_name}</div>
          <div className="text-xs text-gray-400 my-1">vs</div>
          <div className="text-sm font-medium">{m.team2_name}</div>
          {m.winning_team_name && <div className="text-xs mt-2 text-cricket-green font-semibold">Winner: {m.winning_team_name}</div>}
        </div>
      ))}
    </div>
  );
}
