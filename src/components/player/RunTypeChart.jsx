import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = { '1s': '#3b82f6', '2s': '#3b82f6', '3s': '#3b82f6', '4s': '#1a5c38', '6s': '#d4a017', Dots: '#9ca3af' };

export default function RunTypeChart({ stats }) {
  const data = [
    { name: '1s', count: stats.bat_ones || 0 },
    { name: '2s', count: stats.bat_twos || 0 },
    { name: '3s', count: stats.bat_threes || 0 },
    { name: '4s', count: stats.bat_fours || 0 },
    { name: '6s', count: stats.bat_sixes || 0 },
    { name: 'Dots', count: stats.bat_dot_balls || 0 },
  ];

  return (
    <div className="card p-3" style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={40} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map(d => <Cell key={d.name} fill={COLORS[d.name]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
