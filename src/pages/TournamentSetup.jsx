import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserPlus, X, CheckCircle2, ArrowLeftRight, Trash2 } from 'lucide-react';
import * as tournamentService from '../services/tournamentService';
import * as matchService from '../services/matchService';
import * as venueService from '../services/venueService';
import { usePlayerStore } from '../stores/playerStore';
import { useRole } from '../hooks/useRole';
import BottomSheet from '../components/shared/BottomSheet';
import PlayerSearch from '../components/match/PlayerSearch';

export default function TournamentSetup() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManageTournaments } = useRole();
  if (!canManageTournaments) { navigate('/'); return null; }
  const players = usePlayerStore(s => s.players);
  const fetchPlayers = usePlayerStore(s => s.fetchPlayers);
  const addPlayer = usePlayerStore(s => s.addPlayer);

  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamPlayers, setTeamPlayers] = useState({});
  const [matchesExist, setMatchesExist] = useState(false);
  const [totalOvers, setTotalOvers] = useState(20);
  const [teamSize, setTeamSize] = useState(11);
  const [venueId, setVenueId] = useState('');
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);

  // Squad picker (add/remove mode)
  // captainIds / keeperIds: { [teamId]: playerId | null }
  const [captainIds, setCaptainIds] = useState({});
  const [keeperIds, setKeeperIds] = useState({});

  const [pickerTeamId, setPickerTeamId] = useState(null);

  // Player action sheet (tap a player chip → remove or replace)
  const [actionPlayer, setActionPlayer] = useState(null); // { teamId, playerId }

  // Replace mode: triggered from action sheet
  const [replaceTeamId, setReplaceTeamId] = useState(null);
  const [replacePlayerId, setReplacePlayerId] = useState(null);

  const isSeries = !!tournament?.series_matches;

  useEffect(() => {
    fetchPlayers({ activeOnly: true });
    venueService.listVenues().then(setVenues);
    Promise.all([
      tournamentService.getTournament(id),
      tournamentService.getTournamentTeams(id),
      tournamentService.getTournamentMatches(id),
      tournamentService.getTeamPlayersForTournament(id),
    ]).then(([t, ts, matches, playerMap]) => {
      setTournament(t);
      setTeams(ts);
      setMatchesExist(matches.length > 0);
      setTeamPlayers(playerMap);
      if (t.venue_id) setVenueId(t.venue_id);
    });
  }, [id]);

  // Players assigned to teams other than the current picker/replace team
  const allAssigned = useMemo(() => {
    const targetTeam = pickerTeamId || replaceTeamId;
    const all = new Set();
    for (const [teamId, ids] of Object.entries(teamPlayers)) {
      if (teamId !== targetTeam) ids.forEach(pid => all.add(pid));
    }
    return [...all];
  }, [teamPlayers, pickerTeamId, replaceTeamId]);

  function playerName(playerId) {
    return players.find(p => p.id === playerId)?.name || playerId;
  }

  // ── Squad picker (add/edit mode) ──────────────────────────────
  function togglePlayer(playerId) {
    if (!pickerTeamId) return;
    setTeamPlayers(prev => {
      const current = prev[pickerTeamId] || [];
      const isSelected = current.includes(playerId);
      if (!isSelected && isSeries && current.length >= teamSize) {
        toast.error(`Max ${teamSize} players per team`);
        return prev;
      }
      const next = isSelected ? current.filter(x => x !== playerId) : [...current, playerId];
      return { ...prev, [pickerTeamId]: next };
    });
  }

  async function handleQuickAdd(name) {
    try {
      const p = await addPlayer({ name });
      togglePlayer(p.id);
      toast.success(`${p.name} added`);
    } catch (e) {
      toast.error(e.message || 'Failed to add player');
    }
  }

  // ── Player action sheet ───────────────────────────────────────
  function removePlayerFromTeam(teamId, playerId) {
    setTeamPlayers(prev => ({
      ...prev,
      [teamId]: (prev[teamId] || []).filter(x => x !== playerId),
    }));
    setActionPlayer(null);
  }

  function openReplace(teamId, playerId) {
    setActionPlayer(null);
    setReplaceTeamId(teamId);
    setReplacePlayerId(playerId);
  }

  function handleReplaceSelect(newPlayerId) {
    if (!replaceTeamId || !replacePlayerId) return;
    setTeamPlayers(prev => {
      const updated = { ...prev };
      // Remove the new player from whichever team they're currently on (swap)
      for (const tid of Object.keys(updated)) {
        if (updated[tid]?.includes(newPlayerId)) {
          updated[tid] = updated[tid].filter(x => x !== newPlayerId);
        }
      }
      // Replace the old player with the new one in the target team
      updated[replaceTeamId] = (updated[replaceTeamId] || []).map(x =>
        x === replacePlayerId ? newPlayerId : x
      );
      return updated;
    });
    setReplaceTeamId(null);
    setReplacePlayerId(null);
    toast.success('Player replaced');
  }

  // In replace mode: show all players except those already on the same team (excluding the one being replaced)
  const replaceCandidateDisabled = useMemo(() => {
    if (!replaceTeamId || !replacePlayerId) return [];
    const sameTeam = (teamPlayers[replaceTeamId] || []).filter(x => x !== replacePlayerId);
    return sameTeam;
  }, [teamPlayers, replaceTeamId, replacePlayerId]);

  // ── Validation ────────────────────────────────────────────────
  const canCreateMatches = useMemo(() => {
    if (!isSeries || matchesExist) return false;
    if (totalOvers < 1 || teamSize < 6 || teamSize > 11) return false;
    const squadsReady = teams.every(t => (teamPlayers[t.id] || []).length >= teamSize);
    const captainsReady = teams.every(t => !!captainIds[t.id]);
    return squadsReady && captainsReady;
  }, [isSeries, matchesExist, totalOvers, teamSize, teams, teamPlayers, captainIds, keeperIds]);

  const canSave = useMemo(() => teams.some(t => (teamPlayers[t.id] || []).length > 0), [teams, teamPlayers]);

  // ── Actions ───────────────────────────────────────────────────
  async function handleCreateMatches() {
    setLoading(true);
    try {
      await Promise.all(teams.map(t => tournamentService.setTeamPlayers(t.id, teamPlayers[t.id] || [])));
      const team1Ids = teamPlayers[teams[0].id] || [];
      const team2Ids = teamPlayers[teams[1].id] || [];
      const matchPlayerRows = [
        ...team1Ids.map((pid, i) => ({ player_id: pid, team: 1, batting_position: i + 1, is_captain: pid === captainIds[teams[0].id], is_keeper: pid === keeperIds[teams[0].id] })),
        ...team2Ids.map((pid, i) => ({ player_id: pid, team: 2, batting_position: i + 1, is_captain: pid === captainIds[teams[1].id], is_keeper: pid === keeperIds[teams[1].id] })),
      ];
      for (let i = 0; i < tournament.series_matches; i++) {
        const match = await matchService.createMatch({
          tournament_id: tournament.id,
          team1_name: teams[0].name,
          team2_name: teams[1].name,
          total_overs: Number(totalOvers),
          team_size: Number(teamSize),
          venue_id: venueId || null,
          status: 'upcoming',
        });
        await matchService.setMatchPlayers(match.id, matchPlayerRows);
      }
      toast.success(`${tournament.series_matches} matches created`);
      navigate(`/tournaments/${id}`);
    } catch (e) {
      toast.error(e.message || 'Failed to create matches');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setLoading(true);
    try {
      await Promise.all(teams.map(t => tournamentService.setTeamPlayers(t.id, teamPlayers[t.id] || [])));
      toast.success('Player assignments saved');
      navigate(`/tournaments/${id}`);
    } catch (e) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  if (!tournament) return null;

  const actionTeam = actionPlayer ? teams.find(t => t.id === actionPlayer.teamId) : null;

  return (
    <div className="p-4 space-y-5 page-transition pb-28">
      {/* Header */}
      <div>
        <Link to={`/tournaments/${id}`} className="text-sm text-ink-500 dark:text-ink-300 hover:text-ink-900 dark:hover:text-white">
          ← {tournament.name}
        </Link>
        <h1 className="text-xl font-bold text-ink-900 dark:text-white mt-1">Setup Teams</h1>
        <p className="text-sm text-ink-500 dark:text-ink-300 mt-0.5">
          Tap a player to remove or replace them. Use "Edit Squad" to add more.
        </p>
      </div>

      {/* Match settings — series only */}
      {isSeries && (
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold">Match Settings</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Total overs</label>
              <input type="number" min={1} max={100} value={totalOvers}
                onChange={e => setTotalOvers(Number(e.target.value))} className="field-input tabular-nums" />
            </div>
            <div>
              <label className="field-label">Team size (6–11)</label>
              <input type="number" min={6} max={11} value={teamSize}
                onChange={e => setTeamSize(Number(e.target.value))} className="field-input tabular-nums" />
            </div>
          </div>
          <div>
            <label className="field-label">Venue (optional)</label>
            <select value={venueId} onChange={e => setVenueId(e.target.value)} className="field-input">
              <option value="">No venue</option>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}{v.city ? `, ${v.city}` : ''}</option>)}
            </select>
          </div>
          <p className="text-xs text-ink-400">Best of {tournament.series_matches} · {tournament.series_matches} matches will be created</p>
        </div>
      )}

      {/* Teams */}
      {teams.map(team => {
        const assigned = teamPlayers[team.id] || [];
        const isComplete = isSeries ? assigned.length >= teamSize : assigned.length > 0;
        const pct = isSeries ? Math.min((assigned.length / teamSize) * 100, 100) : 0;

        return (
          <div key={team.id} className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
              <div>
                <h2 className="font-bold text-base text-ink-900 dark:text-white">{team.name}</h2>
                <p className="text-xs text-ink-400 mt-0.5">
                  {assigned.length}{isSeries ? ` / ${teamSize}` : ''} players assigned
                </p>
              </div>
              {isComplete
                ? <CheckCircle2 size={22} className="text-brand-green shrink-0" />
                : isSeries && (
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                    {teamSize - assigned.length} more needed
                  </span>
                )
              }
            </div>

            {isSeries && (
              <div className="h-1 bg-ink-100 dark:bg-white/10 mx-4 rounded-full overflow-hidden mb-3">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-green to-brand-teal transition-all duration-300"
                  style={{ width: `${pct}%` }} />
              </div>
            )}

            {/* Player chips — tappable */}
            {assigned.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pb-3">
                {assigned.map(pid => (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => setActionPlayer({ teamId: team.id, playerId: pid })}
                    className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-ink-50 dark:bg-white/5 border border-ink-100 dark:border-white/10 hover:border-brand-green/40 hover:bg-brand-green/5 transition-colors active:scale-95"
                  >
                    <span className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-green to-brand-teal flex items-center justify-center text-white text-[9px] font-bold uppercase shrink-0">
                      {playerName(pid)[0]}
                    </span>
                    <span className="text-xs font-medium text-ink-700 dark:text-ink-200">{playerName(pid)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Captain + Keeper selects — series only, shown once squad has players */}
            {isSeries && assigned.length > 0 && (
              <div className="px-4 pb-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-1">
                    Captain <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={captainIds[team.id] || ''}
                    onChange={e => setCaptainIds(prev => ({ ...prev, [team.id]: e.target.value || null }))}
                    className="field-input !py-1.5 !text-sm"
                  >
                    <option value="">Select *</option>
                    {assigned.map(pid => (
                      <option key={pid} value={pid}>{playerName(pid)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-1">
                    Keeper (optional)
                  </label>
                  <select
                    value={keeperIds[team.id] || ''}
                    onChange={e => setKeeperIds(prev => ({ ...prev, [team.id]: e.target.value || null }))}
                    className="field-input !py-1.5 !text-sm"
                  >
                    <option value="">Select (optional)</option>
                    {assigned.map(pid => (
                      <option key={pid} value={pid}>{playerName(pid)}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPickerTeamId(team.id)}
              className="w-full flex items-center justify-center gap-2 py-3 border-t border-ink-100 dark:border-white/10 text-sm font-semibold text-ink-500 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-white/5 transition-colors"
            >
              <UserPlus size={15} />
              {assigned.length === 0 ? 'Add Players' : 'Edit Squad'}
            </button>
          </div>
        );
      })}

      {/* Action buttons */}
      {isSeries ? (
        matchesExist ? (
          <div className="w-full py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-center text-sm font-semibold text-green-700 dark:text-green-400">
            ✓ Series matches already created
          </div>
        ) : (
          <button type="button" onClick={handleCreateMatches} disabled={!canCreateMatches || loading}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Creating…' : `Create ${tournament.series_matches} Matches`}
          </button>
        )
      ) : (
        <button type="button" onClick={handleSave} disabled={!canSave || loading}
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
          {loading ? 'Saving…' : 'Save Player Assignments'}
        </button>
      )}

      {isSeries && matchesExist && (
        <button type="button" onClick={handleSave} disabled={loading} className="btn-secondary w-full">
          Save Player Assignments
        </button>
      )}

      {/* ── Squad picker (add/edit) ── */}
      <BottomSheet
        open={!!pickerTeamId}
        onClose={() => setPickerTeamId(null)}
        title={`Edit Squad — ${teams.find(t => t.id === pickerTeamId)?.name || ''}`}
        heightClass="h-[88vh]"
      >
        <PlayerSearch
          players={players}
          selectedIds={pickerTeamId ? (teamPlayers[pickerTeamId] || []) : []}
          disabledIds={allAssigned}
          onToggle={togglePlayer}
          onQuickAdd={handleQuickAdd}
          maxSelectable={isSeries ? teamSize : undefined}
        />
      </BottomSheet>

      {/* ── Player action sheet ── */}
      <BottomSheet
        open={!!actionPlayer}
        onClose={() => setActionPlayer(null)}
        title={actionPlayer ? playerName(actionPlayer.playerId) : ''}
        heightClass="h-auto"
      >
        {actionPlayer && (
          <div className="space-y-2 pb-2">
            <p className="text-xs text-ink-400 mb-3">
              {actionTeam?.name} · tap an action below
            </p>
            <button
              type="button"
              onClick={() => openReplace(actionPlayer.teamId, actionPlayer.playerId)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-ink-50 dark:bg-white/5 hover:bg-brand-green/10 dark:hover:bg-brand-green/10 transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <ArrowLeftRight size={16} className="text-blue-600 dark:text-blue-400" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900 dark:text-white">Replace player</p>
                <p className="text-xs text-ink-400 mt-0.5">Swap with another player or move from another team</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => removePlayerFromTeam(actionPlayer.teamId, actionPlayer.playerId)}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-ink-50 dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
            >
              <span className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <Trash2 size={16} className="text-red-500" />
              </span>
              <div>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">Remove from team</p>
                <p className="text-xs text-ink-400 mt-0.5">Returns player to the unassigned pool</p>
              </div>
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ── Replace picker ── */}
      <BottomSheet
        open={!!replaceTeamId}
        onClose={() => { setReplaceTeamId(null); setReplacePlayerId(null); }}
        title={`Replace ${replacePlayerId ? playerName(replacePlayerId) : ''}`}
        heightClass="h-[88vh]"
      >
        <PlayerSearch
          players={players}
          selectedIds={[]}
          disabledIds={replaceCandidateDisabled}
          onToggle={handleReplaceSelect}
          onQuickAdd={async name => {
            try {
              const p = await addPlayer({ name });
              handleReplaceSelect(p.id);
              toast.success(`${p.name} added`);
            } catch (e) {
              toast.error(e.message || 'Failed to add player');
            }
          }}
        />
      </BottomSheet>
    </div>
  );
}
