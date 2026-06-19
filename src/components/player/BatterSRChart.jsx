import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fmt } from '../../lib/cricketUtils';

function srColor(sr) {
  if (sr === 0) return '#9ca3af';
  if (sr >= 150) return '#178a52';
  if (sr >= 100) return '#2563eb';
  if (sr >= 50) return '#e0a929';
  return '#ef4444';
}

function buildData(deliveries, batsmanId) {
  const overMap = new Map();
  for (const d of deliveries) {
    if (d.batsman_id !== batsmanId) continue;
    if (d.extra_type === 'wide') continue;
    const ov = d.over_number ?? 0;
    if (!overMap.has(ov)) overMap.set(ov, { over: ov + 1, runs: 0, balls: 0 });
    const entry = overMap.get(ov);
    entry.runs += d.runs_off_bat ?? 0;
    entry.balls += 1;
  }
  return Array.from(overMap.values())
    .sort((a, b) => a.over - b.over)
    .map(e => ({ ...e, sr: e.balls > 0 ? (e.runs / e.balls) * 100 : 0 }));
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-ink-800 border border-ink-100 dark:border-white/10 rounded-lg px-3 py-2 text-xs shadow-card">
      <p className="font-bold text-ink-900 dark:text-white">Over {d.over}</p>
      <p className="text-ink-600 dark:text-ink-300">{d.runs}R · {d.balls}B · SR {fmt(d.sr, 1)}</p>
    </div>
  );
}

export default function BatterSRChart({ deliveries, batsmanId }) {
  const data = buildData(deliveries, batsmanId);

  if (data.length === 0) {
    return <p className="text-sm text-ink-400 text-center py-8">Did not bat in this innings</p>;
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis dataKey="over" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 'auto']} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="sr" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={srColor(entry.sr)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 justify-center flex-wrap text-[10px] text-ink-500">
        {[['#178a52', 'SR ≥150'], ['#2563eb', 'SR ≥100'], ['#e0a929', 'SR ≥50'], ['#ef4444', 'SR <50'], ['#9ca3af', 'No runs']].map(([color, label]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
