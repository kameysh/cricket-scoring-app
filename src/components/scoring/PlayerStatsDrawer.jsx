import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import BottomSheet from '../shared/BottomSheet';
import PlayerAvatar from '../player/PlayerAvatar';
import * as playerService from '../../services/playerService';
import { calcStrikeRate, calcBattingAverage, calcBowlingAverage, calcEconomy, formatOvers, fmt } from '../../lib/cricketUtils';
import { useMatchStore } from '../../stores/matchStore';

export default function PlayerStatsDrawer() {
  const playerId = useMatchStore(s => s.statsDrawerPlayerId);
  const close = useMatchStore(s => s.setStatsDrawerPlayer);
  const [player, setPlayer] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!playerId) return;
    playerService.getPlayer(playerId).then(setPlayer);
    playerService.getCareerStats(playerId).then(setStats);
  }, [playerId]);

  if (!playerId) return null;

  return (
    <BottomSheet open={!!playerId} onClose={() => close(null)} title="Player Stats">
      {!player || !stats ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <PlayerAvatar name={player.name} photoUrl={player.photo_url} size={56} />
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{player.name}</p>
              <p className="text-xs text-gray-500">{[player.batting_style, player.bowling_style].filter(Boolean).join(' · ')}</p>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-1.5">Batting</h4>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><div className="font-bold">{stats.bat_matches}</div><div className="text-xs text-gray-400">M</div></div>
              <div><div className="font-bold">{stats.bat_runs}</div><div className="text-xs text-gray-400">Runs</div></div>
              <div><div className="font-bold">{fmt(calcBattingAverage(stats.bat_runs, stats.bat_innings, stats.bat_not_outs))}</div><div className="text-xs text-gray-400">Avg</div></div>
              <div><div className="font-bold">{fmt(calcStrikeRate(stats.bat_runs, stats.bat_balls))}</div><div className="text-xs text-gray-400">SR</div></div>
              <div><div className="font-bold">{stats.bat_highest_score}{stats.bat_highest_score_not_out ? '*' : ''}</div><div className="text-xs text-gray-400">HS</div></div>
              <div><div className="font-bold">{stats.bat_innings}</div><div className="text-xs text-gray-400">Inn</div></div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-1.5">Bowling</h4>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><div className="font-bold">{stats.bowl_matches}</div><div className="text-xs text-gray-400">M</div></div>
              <div><div className="font-bold">{stats.bowl_wickets}</div><div className="text-xs text-gray-400">Wkts</div></div>
              <div><div className="font-bold">{fmt(calcBowlingAverage(stats.bowl_runs, stats.bowl_wickets))}</div><div className="text-xs text-gray-400">Avg</div></div>
              <div><div className="font-bold">{fmt(calcEconomy(stats.bowl_runs, stats.bowl_legal_balls))}</div><div className="text-xs text-gray-400">Econ</div></div>
              <div><div className="font-bold">{formatOvers(stats.bowl_legal_balls)}</div><div className="text-xs text-gray-400">Overs</div></div>
              <div><div className="font-bold">{stats.bowl_best_wickets}/{stats.bowl_best_runs}</div><div className="text-xs text-gray-400">BB</div></div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => close(null)} className="btn-secondary flex-1 !py-2.5 text-sm">
              ← Back to Match
            </button>
            <Link to={`/players/${playerId}`} target="_blank" rel="noopener noreferrer" className="btn-primary flex-1 text-center !py-2.5 text-sm">
              Full Profile
            </Link>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
