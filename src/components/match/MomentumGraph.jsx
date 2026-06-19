import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function buildData(deliveries) {
  const overMap = new Map();
  for (const d of deliveries) {
    const ov = d.over_number ?? 0;
    if (!overMap.has(ov)) overMap.set(ov, { over: ov + 1, runs: 0, wickets: 0 });
    const entry = overMap.get(ov);
    if (!['bye', 'leg_bye'].includes(d.extra_type)) {
      entry.runs += d.total_runs_on_delivery ?? 0;
    }
    if (d.is_wicket) entry.wickets += 1;
  }
  return Array.from(overMap.values()).sort((a, b) => a.over - b.over);
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-ink-800 border border-ink-100 dark:border-white/10 rounded-lg px-3 py-2 text-xs shadow-card">
      <p className="font-bold text-ink-900 dark:text-white">Over {d.over}: {d.runs} runs</p>
      {d.wickets > 0 && <p className="text-red-500">{d.wickets} wkt{d.wickets > 1 ? 's' : ''}</p>}
    </div>
  );
}

export default function MomentumGraph({ deliveries }) {
  const data = buildData(deliveries);

  if (data.length === 0) {
    return (
      <div className="card p-3">
        <p className="text-xs text-ink-400 text-center py-4">No deliveries recorded</p>
      </div>
    );
  }

  return (
    <div className="card p-3 space-y-1">
      <p className="text-xs font-semibold text-ink-500 dark:text-ink-300 uppercase tracking-wide">Match Momentum</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis dataKey="over" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="runs" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.wickets > 0 ? '#ef4444' : '#178a52'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-ink-400 text-center">Red bars = wicket fell that over</p>
    </div>
  );
}
