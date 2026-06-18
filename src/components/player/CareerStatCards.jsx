function StatCard({ label, value }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-xl font-bold text-cricket-green dark:text-cricket-gold">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

export function BattingSummaryGrid({ stats, derived }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard label="Matches" value={stats.bat_matches} />
      <StatCard label="Innings" value={stats.bat_innings} />
      <StatCard label="Not Outs" value={stats.bat_not_outs} />
      <StatCard label="Runs" value={stats.bat_runs} />
      <StatCard label="Highest Score" value={`${stats.bat_highest_score}${stats.bat_highest_score_not_out ? '*' : ''}`} />
      <StatCard label="Average" value={derived.average} />
      <StatCard label="Strike Rate" value={derived.strikeRate} />
      <StatCard label="Balls Faced" value={stats.bat_balls} />
    </div>
  );
}

export function RunBreakdownGrid({ stats }) {
  const items = [
    ['1s', stats.bat_ones], ['2s', stats.bat_twos], ['3s', stats.bat_threes],
    ['4s', stats.bat_fours], ['6s', stats.bat_sixes], ['Dots', stats.bat_dot_balls],
    ['Ducks', stats.bat_ducks], ['50s', stats.bat_fifties], ['100s', stats.bat_hundreds],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}
    </div>
  );
}

export function BowlingSummaryGrid({ stats, derived }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard label="Matches" value={stats.bowl_matches} />
      <StatCard label="Innings" value={stats.bowl_innings} />
      <StatCard label="Overs" value={derived.overs} />
      <StatCard label="Wickets" value={stats.bowl_wickets} />
      <StatCard label="Runs Conceded" value={stats.bowl_runs} />
      <StatCard label="Average" value={derived.average} />
      <StatCard label="Economy" value={derived.economy} />
      <StatCard label="Strike Rate" value={derived.strikeRate} />
      <StatCard label="Maidens" value={stats.bowl_maidens} />
      <StatCard label="Best Figures" value={derived.bestFigures} />
      <StatCard label="4W Hauls" value={stats.bowl_four_wicket_hauls} />
      <StatCard label="5W Hauls" value={stats.bowl_five_wicket_hauls} />
    </div>
  );
}

export function FieldingSummaryGrid({ stats }) {
  const total = (stats.field_catches || 0) + (stats.field_stumpings || 0) + (stats.field_run_outs || 0);
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard label="Matches" value={stats.field_matches} />
      <StatCard label="Catches" value={stats.field_catches} />
      <StatCard label="Stumpings" value={stats.field_stumpings} />
      <StatCard label="Run Outs" value={stats.field_run_outs} />
      <StatCard label="Total Dismissals" value={total} />
    </div>
  );
}

export default StatCard;
