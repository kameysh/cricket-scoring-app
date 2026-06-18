import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#1a5c38', '#d4a017', '#3b82f6', '#ef4444', '#9333ea'];
const LABELS = { bowled: 'Bowled', caught: 'Caught', lbw: 'LBW', stumped: 'Stumped', hit_wicket: 'Hit Wicket' };

export default function WicketTypeDonut({ counts }) {
  const data = Object.entries(counts || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: LABELS[k] || k, value: v }));

  if (data.length === 0) {
    return <div className="text-sm text-gray-400 text-center py-8">No wickets yet</div>;
  }

  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
