import { useEffect, useState } from 'react';
import { Swords } from 'lucide-react';
import BottomSheet from '../shared/BottomSheet';
import PlayerAvatar from './PlayerAvatar';
import { getPlayerVsPlayer } from '../../services/playerService';
import PlayerName from '../shared/PlayerName';

function StatRow({ label, p1Val, p2Val, lowerIsBetter = false }) {
  const p1Num = parseFloat(p1Val);
  const p2Num = parseFloat(p2Val);
  let p1Wins = false, p2Wins = false;
  if (!isNaN(p1Num) && !isNaN(p2Num) && p1Num !== p2Num) {
    p1Wins = lowerIsBetter ? p1Num < p2Num : p1Num > p2Num;
    p2Wins = lowerIsBetter ? p2Num < p1Num : p2Num > p1Num;
  }
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center py-1.5 border-b border-ink-100 dark:border-white/10 last:border-0">
      <p className={`text-sm font-bold text-right tabular-nums pr-3 ${p1Wins ? 'text-brand-green' : 'text-ink-800 dark:text-white'}`}>
        {p1Val ?? '—'}
      </p>
      <p className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider text-center w-14">{label}</p>
      <p className={`text-sm font-bold text-left tabular-nums pl-3 ${p2Wins ? 'text-brand-green' : 'text-ink-800 dark:text-white'}`}>
        {p2Val ?? '—'}
      </p>
    </div>
  );
}

function BattleCard({ batterName, bowlerName, data }) {
  return (
    <div className="rounded-xl bg-ink-50 dark:bg-white/5 px-3 py-2">
      <p className="text-[10px] text-ink-500 mb-1.5">
        <span className="font-bold text-ink-800 dark:text-white">{batterName}</span>
        <span className="mx-1 text-ink-300">bat ·</span>
        <span className="font-bold text-ink-800 dark:text-white">{bowlerName}</span>
        <span className="ml-1 text-ink-400">bowl</span>
      </p>
      <div className="grid grid-cols-5 gap-1">
        {[['Balls', data.balls], ['Runs', data.runs], ['Dis', data.dismissed], ['SR', data.sr], ['Dot%', `${data.dotPct}%`]].map(([l, v]) => (
          <div key={l} className="flex flex-col items-center bg-white dark:bg-white/10 rounded-lg py-1.5">
            <span className="text-xs font-bold text-ink-900 dark:text-white tabular-nums">{v}</span>
            <span className="text-[8px] text-ink-400 uppercase mt-0.5">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlayerVsSheet({ p1, p2, p1Stats, p2Stats, onClose }) {
  const [vsData, setVsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!p1?.id || !p2?.id) return;
    setLoading(true);
    getPlayerVsPlayer(p1.id, p2.id)
      .then(setVsData)
      .catch(() => setVsData(null))
      .finally(() => setLoading(false));
  }, [p1?.id, p2?.id]);

  const hasFaced = vsData && (vsData.p1AsBat.balls > 0 || vsData.p2AsBat.balls > 0);
  const s1 = p1Stats || {};
  const s2 = p2Stats || {};

  function avg(runs, inn, no) {
    const d = (inn || 0) - (no || 0);
    return d ? ((runs || 0) / d).toFixed(1) : '—';
  }
  function sr(runs, balls) {
    return balls ? ((runs || 0) / balls * 100).toFixed(1) : '—';
  }
  function bowlAvg(runs, wkts) {
    return wkts ? ((runs || 0) / wkts).toFixed(1) : '—';
  }
  function econ(runs, balls) {
    return balls ? ((runs || 0) / balls * 6).toFixed(1) : '—';
  }

  const p1First = (p1.nickname?.trim() || p1.name || '').split(' ')[0];
  const p2First = (p2.nickname?.trim() || p2.name || '').split(' ')[0];

  return (
    <BottomSheet open onClose={onClose} title="Head to Head" heightClass="h-auto" noScroll>

      {/* Player header */}
      <div className="flex items-center gap-2 pb-3 border-b border-ink-100 dark:border-white/10">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <PlayerAvatar name={p1.name} photoUrl={p1.photo_url} size={36} />
          <div className="min-w-0">
            <PlayerName player={p1} nameClass="text-sm font-bold text-ink-900 dark:text-white" />
            <p className="text-[10px] text-ink-400 capitalize">{(p1.role || '').replace('_', ' ')}</p>
          </div>
        </div>
        <div className="shrink-0 w-7 h-7 rounded-full bg-ink-100 dark:bg-white/10 flex items-center justify-center">
          <Swords size={13} className="text-ink-400" />
        </div>
        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <div className="min-w-0 text-right">
            <PlayerName player={p2} nameClass="text-sm font-bold text-ink-900 dark:text-white" className="items-end" />
            <p className="text-[10px] text-ink-400 capitalize">{(p2.role || '').replace('_', ' ')}</p>
          </div>
          <PlayerAvatar name={p2.name} photoUrl={p2.photo_url} size={36} />
        </div>
      </div>

      {/* Direct matchup */}
      <div className="mt-3 mb-3">
        <p className="text-[9px] font-bold text-ink-400 uppercase tracking-widest mb-2">Direct Matchup</p>
        {loading ? (
          <p className="text-xs text-ink-400 text-center py-2">Loading…</p>
        ) : !hasFaced ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <span className="text-base shrink-0">🏏</span>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <span className="font-semibold">No shared match history</span>
              <span className="text-amber-600"> — these two have never faced each other.</span>
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {vsData.p1AsBat.balls > 0 && <BattleCard batterName={p1First} bowlerName={p2First} data={vsData.p1AsBat} />}
            {vsData.p2AsBat.balls > 0 && <BattleCard batterName={p2First} bowlerName={p1First} data={vsData.p2AsBat} />}
          </div>
        )}
      </div>

      {/* Career divider */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1">
        <div className="h-px bg-ink-100 dark:bg-white/10" />
        <p className="text-[9px] font-bold text-ink-400 uppercase tracking-widest px-3">Career</p>
        <div className="h-px bg-ink-100 dark:bg-white/10" />
      </div>

      {/* Column name labels */}
      <div className="grid grid-cols-[1fr_auto_1fr] mb-1">
        <p className="text-[10px] font-bold text-ink-600 dark:text-ink-300 text-right pr-3">{p1First}</p>
        <div className="w-14" />
        <p className="text-[10px] font-bold text-ink-600 dark:text-ink-300 text-left pl-3">{p2First}</p>
      </div>

      {/* Batting */}
      <p className="text-[9px] font-bold text-ink-400 uppercase tracking-widest mb-0.5">Batting</p>
      <StatRow label="Runs" p1Val={s1.bat_runs    ?? '—'} p2Val={s2.bat_runs    ?? '—'} />
      <StatRow label="Avg"  p1Val={avg(s1.bat_runs, s1.bat_innings, s1.bat_not_outs)} p2Val={avg(s2.bat_runs, s2.bat_innings, s2.bat_not_outs)} />
      <StatRow label="SR"   p1Val={sr(s1.bat_runs, s1.bat_balls)} p2Val={sr(s2.bat_runs, s2.bat_balls)} />
      <StatRow label="HS"   p1Val={s1.bat_highest_score ?? '—'} p2Val={s2.bat_highest_score ?? '—'} />
      <StatRow label="50s"  p1Val={s1.bat_fifties  ?? '—'} p2Val={s2.bat_fifties  ?? '—'} />
      <StatRow label="100s" p1Val={s1.bat_hundreds ?? '—'} p2Val={s2.bat_hundreds ?? '—'} />

      {/* Bowling */}
      <p className="text-[9px] font-bold text-ink-400 uppercase tracking-widest mt-3 mb-0.5">Bowling</p>
      <StatRow label="Wkts" p1Val={s1.bowl_wickets ?? '—'} p2Val={s2.bowl_wickets ?? '—'} />
      <StatRow label="Avg"  p1Val={bowlAvg(s1.bowl_runs_conceded, s1.bowl_wickets)} p2Val={bowlAvg(s2.bowl_runs_conceded, s2.bowl_wickets)} lowerIsBetter />
      <StatRow label="Econ" p1Val={econ(s1.bowl_runs_conceded, s1.bowl_legal_balls)} p2Val={econ(s2.bowl_runs_conceded, s2.bowl_legal_balls)} lowerIsBetter />

    </BottomSheet>
  );
}
