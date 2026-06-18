import { useState, useMemo } from 'react';
import PlayerLink from '../player/PlayerLink';
import { calcStrikeRate, calcBattingAverage, calcBowlingAverage, calcEconomy, fmt, formatOvers, formatBestFigures } from '../../lib/cricketUtils';

export default function TournamentLeaderboard({ batting, bowling, fielding }) {
  const [tab, setTab] = useState('batting');
  const [sortKey, setSortKey] = useState(null);

  const battingRows = useMemo(() => {
    const rows = batting.map(b => ({
      ...b,
      avg: calcBattingAverage(b.bat_runs, b.bat_innings, b.bat_not_outs),
      sr: calcStrikeRate(b.bat_runs, b.bat_balls),
    }));
    const key = sortKey || 'bat_runs';
    return rows.sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity));
  }, [batting, sortKey]);

  const bowlingRows = useMemo(() => {
    const rows = bowling.map(b => ({
      ...b,
      avg: calcBowlingAverage(b.bowl_runs, b.bowl_wickets),
      econ: calcEconomy(b.bowl_runs, b.bowl_legal_balls),
    }));
    const key = sortKey || 'bowl_wickets';
    return rows.sort((a, b) => (b[key] ?? -Infinity) - (a[key] ?? -Infinity));
  }, [bowling, sortKey]);

  const fieldingRows = useMemo(() => {
    const rows = fielding.map(f => ({ ...f, total: f.field_catches + f.field_stumpings + f.field_run_outs }));
    return rows.sort((a, b) => b.total - a.total);
  }, [fielding]);

  const mvp = useMemo(() => {
    const byPlayer = new Map();
    for (const b of batting) byPlayer.set(b.player_id, { name: b.players?.name, score: (byPlayer.get(b.player_id)?.score || 0) + b.bat_runs });
    for (const b of bowling) byPlayer.set(b.player_id, { name: b.players?.name, score: (byPlayer.get(b.player_id)?.score || 0) + b.bowl_wickets * 20 });
    const arr = Array.from(byPlayer.values());
    return arr.sort((a, b) => b.score - a.score)[0];
  }, [batting, bowling]);

  function Th({ label, k }) {
    return (
      <th onClick={() => setSortKey(k)} className="py-2 px-1 text-center cursor-pointer select-none">
        {label}
      </th>
    );
  }

  return (
    <div>
      {mvp && (
        <div className="bg-cricket-gold/10 border border-cricket-gold rounded-xl p-3 mb-4">
          <p className="text-xs text-gray-500">Most Valuable Player</p>
          <p className="font-semibold text-gray-900 dark:text-white">{mvp.name}</p>
        </div>
      )}
      <div className="flex gap-2 mb-3">
        {['batting', 'bowling', 'fielding'].map(t => (
          <button key={t} onClick={() => { setTab(t); setSortKey(null); }} className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${tab === t ? 'bg-cricket-green text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        {tab === 'batting' && (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2">#</th><th className="py-2">Player</th>
              <Th label="M" k="bat_matches" /><Th label="Inn" k="bat_innings" /><Th label="Runs" k="bat_runs" />
              <Th label="HS" k="bat_highest_score" /><th className="py-2 px-1 text-center">Avg</th><th className="py-2 px-1 text-center">SR</th>
              <Th label="4s" k="bat_fours" /><Th label="6s" k="bat_sixes" />
            </tr></thead>
            <tbody>
              {battingRows.map((r, i) => (
                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2">{i + 1}</td>
                  <td className="py-2"><PlayerLink id={r.player_id} name={r.players?.name} /></td>
                  <td className="py-2 px-1 text-center">{r.bat_matches}</td>
                  <td className="py-2 px-1 text-center">{r.bat_innings}</td>
                  <td className="py-2 px-1 text-center font-semibold">{r.bat_runs}</td>
                  <td className="py-2 px-1 text-center">{r.bat_highest_score}</td>
                  <td className="py-2 px-1 text-center">{fmt(r.avg)}</td>
                  <td className="py-2 px-1 text-center">{fmt(r.sr)}</td>
                  <td className="py-2 px-1 text-center">{r.bat_fours}</td>
                  <td className="py-2 px-1 text-center">{r.bat_sixes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'bowling' && (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2">#</th><th className="py-2">Player</th>
              <Th label="M" k="bowl_matches" /><Th label="W" k="bowl_wickets" /><th className="py-2 px-1 text-center">Overs</th>
              <Th label="R" k="bowl_runs" /><th className="py-2 px-1 text-center">Avg</th><th className="py-2 px-1 text-center">Econ</th><th className="py-2 px-1 text-center">BB</th>
            </tr></thead>
            <tbody>
              {bowlingRows.map((r, i) => (
                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2">{i + 1}</td>
                  <td className="py-2"><PlayerLink id={r.player_id} name={r.players?.name} /></td>
                  <td className="py-2 px-1 text-center">{r.bowl_matches}</td>
                  <td className="py-2 px-1 text-center font-semibold">{r.bowl_wickets}</td>
                  <td className="py-2 px-1 text-center">{formatOvers(r.bowl_legal_balls)}</td>
                  <td className="py-2 px-1 text-center">{r.bowl_runs}</td>
                  <td className="py-2 px-1 text-center">{fmt(r.avg)}</td>
                  <td className="py-2 px-1 text-center">{fmt(r.econ)}</td>
                  <td className="py-2 px-1 text-center">{formatBestFigures(r.bowl_best_wickets, r.bowl_best_runs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'fielding' && (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="py-2">#</th><th className="py-2">Player</th>
              <th className="py-2 px-1 text-center">Catches</th><th className="py-2 px-1 text-center">Stumpings</th>
              <th className="py-2 px-1 text-center">Run Outs</th><th className="py-2 px-1 text-center">Total</th>
            </tr></thead>
            <tbody>
              {fieldingRows.map((r, i) => (
                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2">{i + 1}</td>
                  <td className="py-2"><PlayerLink id={r.player_id} name={r.players?.name} /></td>
                  <td className="py-2 px-1 text-center">{r.field_catches}</td>
                  <td className="py-2 px-1 text-center">{r.field_stumpings}</td>
                  <td className="py-2 px-1 text-center">{r.field_run_outs}</td>
                  <td className="py-2 px-1 text-center font-semibold">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
