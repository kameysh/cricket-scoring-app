export default function PointsTable({ rows }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-gray-400 text-center py-8">No completed matches yet</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 pr-2">Team</th>
            <th className="py-2 px-1 text-center">P</th>
            <th className="py-2 px-1 text-center">W</th>
            <th className="py-2 px-1 text-center">L</th>
            <th className="py-2 px-1 text-center">T</th>
            <th className="py-2 px-1 text-center">NR</th>
            <th className="py-2 px-1 text-center">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.team} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2 pr-2 font-medium text-gray-900 dark:text-white">{r.team}</td>
              <td className="py-2 px-1 text-center">{r.played}</td>
              <td className="py-2 px-1 text-center">{r.won}</td>
              <td className="py-2 px-1 text-center">{r.lost}</td>
              <td className="py-2 px-1 text-center">{r.tied}</td>
              <td className="py-2 px-1 text-center">{r.nr}</td>
              <td className="py-2 px-1 text-center font-semibold text-cricket-green dark:text-cricket-gold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
