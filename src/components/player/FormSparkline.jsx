import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot } from 'recharts';
import { calcStrikeRate, fmt } from '../../lib/cricketUtils';

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-ink-800 border border-ink-100 dark:border-white/10 rounded-lg px-3 py-2 text-xs shadow-card">
      <p className="font-bold text-ink-900 dark:text-white">{d.runs} runs</p>
      <p className="text-ink-500">{d.balls}b · SR {d.sr}</p>
      {d.notOut && <p className="text-cricket-green text-[10px]">not out</p>}
    </div>
  );
}

export default function FormSparkline({ history }) {
  const data = history
    .filter(h => h.batting && (h.batting.balls_faced > 0 || h.batting.runs > 0))
    .slice(0, 10)
    .reverse()
    .map((h, i) => ({
      label: `#${i + 1}`,
      runs: h.batting.runs ?? 0,
      balls: h.batting.balls_faced ?? 0,
      sr: fmt(calcStrikeRate(h.batting.runs, h.batting.balls_faced), 1),
      notOut: h.batting.status === 'not_out',
    }));

  if (data.length === 0) {
    return (
      <div className="card p-3">
        <p className="text-xs text-ink-400 text-center py-6">No batting innings yet</p>
      </div>
    );
  }

  return (
    <div className="card p-3 space-y-1">
      <p className="text-xs font-semibold text-ink-500 dark:text-ink-300 uppercase tracking-wide">Recent Form</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="runs"
            stroke="#178a52"
            strokeWidth={2}
            dot={<Dot r={3} fill="#178a52" stroke="#fff" strokeWidth={1} />}
            activeDot={{ r: 5, fill: '#178a52' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
