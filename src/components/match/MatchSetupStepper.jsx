import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, Plus, Trophy, MapPin, Users2, Settings2, ClipboardCheck, Star, X } from 'lucide-react';
import TeamSelector from './TeamSelector';
import TossSetup from './TossSetup';
import PlayerSearch from './PlayerSearch';
import PlayerAvatar from '../player/PlayerAvatar';
import { usePlayerStore } from '../../stores/playerStore';
import * as venueService from '../../services/venueService';
import * as tournamentService from '../../services/tournamentService';
import * as matchService from '../../services/matchService';
import * as teamService from '../../services/teamService';

const STEPS = ['Match Info', 'Teams', 'Rules', 'Review'];

export default function MatchSetupStepper() {
  const navigate = useNavigate();
  const players = usePlayerStore(s => s.players);
  const fetchPlayers = usePlayerStore(s => s.fetchPlayers);
  const addPlayer = usePlayerStore(s => s.addPlayer);
  const [venues, setVenues] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [step, setStep] = useState(0);
  const [quickVenueOpen, setQuickVenueOpen] = useState(false);
  const [quickTournamentOpen, setQuickTournamentOpen] = useState(false);
  const [quickVenue, setQuickVenue] = useState({ name: '', city: '', country: '' });
  const [quickTournament, setQuickTournament] = useState({ name: '', type: 'friendly' });

  const [tournamentTeams, setTournamentTeams] = useState([]);
  const [globalTeams, setGlobalTeams] = useState([]);
  const [team1Other, setTeam1Other] = useState(false);
  const [team2Other, setTeam2Other] = useState(false);
  const [form, setForm] = useState({
    tournament_id: '', venue_id: '', total_overs: 20, team_size: 11,
    team1_name: 'Team A', team2_name: 'Team B',
    team1Ids: [], team2Ids: [], jokerId: null,
    team1CaptainId: null, team2CaptainId: null,
    team1KeeperId: null, team2KeeperId: null,
    toss_winner: '', toss_decision: '',
    last_man_standing: false, max_overs_per_bowler: '', super_over_enabled: false, free_hit_on_no_ball: false,
    powerplay_start: '', powerplay_end: '',
  });

  useEffect(() => {
    fetchPlayers({ activeOnly: true });
    venueService.listVenues().then(setVenues);
    tournamentService.listTournaments().then(setTournaments);
    teamService.listTeams().then(teams => {
      setGlobalTeams(teams);
      // Reset defaults so the select shows the placeholder, not 'Team A'/'Team B'
      if (teams.length > 0) setForm(f => ({ ...f, team1_name: '', team2_name: '' }));
    }).catch(err => console.error('Failed to load teams:', err));
  }, []);

  useEffect(() => {
    if (form.tournament_id) {
      tournamentService.getTournamentTeams(form.tournament_id).then(ts => {
        setTournamentTeams(ts);
        if (ts.length >= 2) {
          set({ team1_name: ts[0].name, team2_name: ts[1].name });
        }
      });
    } else {
      setTournamentTeams([]);
    }
  }, [form.tournament_id]);

  const set = patch => setForm(f => ({ ...f, ...patch }));

  async function applyGuestTeam(teamName, slot) {
    const team = globalTeams.find(t => t.name === teamName);
    if (!team) return;
    try {
      const playerIds = await teamService.getTeamPlayers(team.id);
      if (playerIds.length > 0) {
        set(slot === 1
          ? { team1Ids: playerIds, team1CaptainId: null, team1KeeperId: null }
          : { team2Ids: playerIds, team2CaptainId: null, team2KeeperId: null });
        toast.success(`${playerIds.length} players loaded for ${teamName}`);
      }
    } catch {
      // silently ignore — user can pick players manually
    }
  }

  const step1Valid = useMemo(() => {
    const overs = Number(form.total_overs);
    const size = Number(form.team_size);
    return overs >= 1 && overs <= 100 && size >= 6 && size <= 11
      && form.team1_name.trim().length >= 2 && form.team1_name.trim().length <= 40
      && form.team2_name.trim().length >= 2 && form.team2_name.trim().length <= 40
      && form.team1_name.trim().toLowerCase() !== form.team2_name.trim().toLowerCase();
  }, [form]);

  const step2Valid = useMemo(() => {
    const size = Number(form.team_size);
    if (!size) return false;
    const overlap = form.team1Ids.some(id => form.team2Ids.includes(id));
    if (overlap) return false;
    const t1full = form.team1Ids.length === size;
    const t2full = form.team2Ids.length === size;
    const t1short = form.team1Ids.length === size - 1;
    const t2short = form.team2Ids.length === size - 1;
    // No joker: both teams must be full
    // With joker: exactly one team may be one player short (joker fills that side)
    //             OR both teams full (joker is a super-sub, not filling a gap)
    const teamsValid = !form.jokerId
      ? t1full && t2full
      : (t1full && t2full) || (t1full && t2short) || (t2full && t1short);
    return teamsValid && !!form.team1CaptainId && !!form.team2CaptainId;
  }, [form]);

  const step3Valid = useMemo(() => !!form.toss_winner && !!form.toss_decision, [form]);

  function toggleTeam(team, id) {
    const key = team === 1 ? 'team1Ids' : 'team2Ids';
    const otherKey = team === 1 ? 'team2Ids' : 'team1Ids';
    setForm(f => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter(x => x !== id) : [...f[key], id],
      // defensive: a player can never sit on both rosters at once
      [otherKey]: f[otherKey].includes(id) ? f[otherKey].filter(x => x !== id) : f[otherKey],
    }));
  }

  async function handleQuickAddPlayer(team, name) {
    try {
      const player = await addPlayer({ name });
      toggleTeam(team, player.id);
      toast.success(`${player.name} added`);
    } catch (e) {
      toast.error(e.message || 'Failed to add player');
    }
  }

  async function handleQuickAddVenue() {
    if (!quickVenue.name.trim() || !quickVenue.city.trim() || !quickVenue.country.trim()) {
      toast.error('Name, city and country are required');
      return;
    }
    try {
      const venue = await venueService.createVenue(quickVenue);
      setVenues(v => [...v, venue]);
      set({ venue_id: venue.id });
      setQuickVenueOpen(false);
      setQuickVenue({ name: '', city: '', country: '' });
      toast.success('Venue added');
    } catch (e) {
      toast.error(e.message || 'Failed to add venue');
    }
  }

  async function handleQuickAddTournament() {
    if (quickTournament.name.trim().length < 2) {
      toast.error('Tournament name is required');
      return;
    }
    try {
      const tournament = await tournamentService.createTournament(quickTournament);
      setTournaments(t => [...t, tournament]);
      set({ tournament_id: tournament.id });
      setQuickTournamentOpen(false);
      setQuickTournament({ name: '', type: 'friendly' });
      toast.success('Tournament added');
    } catch (e) {
      toast.error(e.message || 'Failed to add tournament');
    }
  }

  async function handleStart() {
    if (form.powerplay_start && form.powerplay_end) {
      if (Number(form.powerplay_start) >= Number(form.powerplay_end)) {
        toast.error('Powerplay start must be before end'); return;
      }
      if (Number(form.powerplay_end) > Number(form.total_overs)) {
        toast.error('Powerplay end cannot exceed total overs'); return;
      }
    }
    try {
      // Auto-register new team names typed via "Other / New team…" into the Teams registry
      const t1 = form.team1_name.trim();
      const t2 = form.team2_name.trim();
      if (team1Other && t1 && !globalTeams.find(t => t.name === t1)) {
        teamService.addTeam(t1).catch(() => {}); // non-blocking, best-effort
      }
      if (team2Other && t2 && !globalTeams.find(t => t.name === t2)) {
        teamService.addTeam(t2).catch(() => {}); // non-blocking, best-effort
      }

      const joker_player_id = form.jokerId || null;
      const match = await matchService.createMatch({
        tournament_id: form.tournament_id || null,
        venue_id: form.venue_id || null,
        team1_name: form.team1_name.trim(),
        team2_name: form.team2_name.trim(),
        total_overs: Number(form.total_overs),
        team_size: Number(form.team_size),
        max_overs_per_bowler: form.max_overs_per_bowler ? Number(form.max_overs_per_bowler) : null,
        last_man_standing: form.last_man_standing,
        super_over_enabled: form.super_over_enabled,
        free_hit_on_no_ball: form.free_hit_on_no_ball,
        powerplay_start: form.powerplay_start ? Number(form.powerplay_start) : null,
        powerplay_end: form.powerplay_end ? Number(form.powerplay_end) : null,
        toss_winner: form.toss_winner,
        toss_decision: form.toss_decision,
        joker_player_id,
      });

      const matchPlayers = [
        ...form.team1Ids.map((id, idx) => ({ player_id: id, team: 1, batting_position: idx + 1, is_captain: id === form.team1CaptainId, is_keeper: id === form.team1KeeperId })),
        ...form.team2Ids.map((id, idx) => ({ player_id: id, team: 2, batting_position: idx + 1, is_captain: id === form.team2CaptainId, is_keeper: id === form.team2KeeperId })),
      ];
      if (form.jokerId) matchPlayers.push({ player_id: form.jokerId, team: 0, batting_position: null, is_captain: false, is_keeper: false });

      await matchService.setMatchPlayers(match.id, matchPlayers);

      const battingTeam = (form.toss_winner === 'team1' && form.toss_decision === 'bat') || (form.toss_winner === 'team2' && form.toss_decision === 'field') ? 1 : 2;
      await matchService.createInnings(match.id, 1, battingTeam);
      await matchService.startMatch(match.id);

      toast.success('Match started!');
      navigate(`/matches/${match.id}`);
    } catch (e) {
      toast.error(e.message || 'Failed to start match');
    }
  }

  const canNext = [step1Valid, step2Valid, step3Valid, true][step];

  return (
    <div className="pb-28">
      <div className="relative flex items-start justify-between mb-8 px-1">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-100 dark:bg-white/10 mx-8" />
        <div
          className="absolute top-4 left-8 h-0.5 bg-gradient-to-r from-brand-green via-brand-teal to-brand-blue transition-all duration-300"
          style={{ width: `calc(${(step / (STEPS.length - 1)) * 100}% - ${step === 0 || step === STEPS.length - 1 ? '64px' : '32px'})` }}
        />
        {STEPS.map((label, i) => (
          <div key={label} className="relative z-10 flex-1 flex flex-col items-center gap-1.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < step ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900' : i === step ? 'bg-gradient-to-br from-brand-green via-brand-teal to-brand-blue text-white ring-4 ring-ink-100 dark:ring-white/10' : 'bg-ink-100 dark:bg-white/10 text-ink-400'
              }`}
            >
              {i < step ? <Check size={16} strokeWidth={2.5} /> : i + 1}
            </div>
            <span className={`text-[11px] font-medium text-center ${i === step ? 'text-ink-800 dark:text-white' : 'text-ink-400'}`}>{label}</span>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="card p-4 space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="field-label !mb-0 flex items-center gap-1.5"><Trophy size={14} className="text-ink-400" /> Tournament (optional)</label>
              <button type="button" onClick={() => setQuickTournamentOpen(o => !o)} className="flex items-center gap-1 text-xs font-semibold text-brand-blue dark:text-white">
                <Plus size={14} /> New
              </button>
            </div>
            <select value={form.tournament_id} onChange={e => set({ tournament_id: e.target.value })} className="field-input">
              <option value="">None / Friendly</option>
              {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {quickTournamentOpen && (
              <div className="quick-add-panel">
                <input
                  value={quickTournament.name}
                  onChange={e => setQuickTournament({ ...quickTournament, name: e.target.value })}
                  placeholder="Tournament name"
                  className="field-input"
                />
                <select
                  value={quickTournament.type}
                  onChange={e => setQuickTournament({ ...quickTournament, type: e.target.value })}
                  className="field-input"
                >
                  <option value="friendly">Friendly</option>
                  <option value="league">League</option>
                  <option value="knockout">Knockout</option>
                </select>
                <button type="button" onClick={handleQuickAddTournament} className="btn-primary w-full !py-2 text-sm">
                  Add Tournament
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="field-label !mb-0 flex items-center gap-1.5"><MapPin size={14} className="text-ink-400" /> Venue (optional)</label>
              <button type="button" onClick={() => setQuickVenueOpen(o => !o)} className="flex items-center gap-1 text-xs font-semibold text-brand-blue dark:text-white">
                <Plus size={14} /> New
              </button>
            </div>
            <select value={form.venue_id} onChange={e => set({ venue_id: e.target.value })} className="field-input">
              <option value="">None</option>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}, {v.city}</option>)}
            </select>
            {quickVenueOpen && (
              <div className="quick-add-panel">
                <input
                  value={quickVenue.name}
                  onChange={e => setQuickVenue({ ...quickVenue, name: e.target.value })}
                  placeholder="Venue name"
                  className="field-input"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={quickVenue.city}
                    onChange={e => setQuickVenue({ ...quickVenue, city: e.target.value })}
                    placeholder="City"
                    className="field-input"
                  />
                  <input
                    value={quickVenue.country}
                    onChange={e => setQuickVenue({ ...quickVenue, country: e.target.value })}
                    placeholder="Country"
                    className="field-input"
                  />
                </div>
                <button type="button" onClick={handleQuickAddVenue} className="btn-primary w-full !py-2 text-sm">
                  Add Venue
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Team 1 name</label>
              {tournamentTeams.length > 0 ? (
                <select value={form.team1_name} onChange={e => { set({ team1_name: e.target.value }); applyGuestTeam(e.target.value, 1); }} className="field-input">
                  {tournamentTeams.filter(t => t.name !== form.team2_name).map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              ) : globalTeams.length > 0 ? (
                <>
                  <select
                    value={team1Other ? '__other__' : form.team1_name}
                    onChange={e => {
                      if (e.target.value === '__other__') { setTeam1Other(true); set({ team1_name: '' }); }
                      else { setTeam1Other(false); set({ team1_name: e.target.value }); applyGuestTeam(e.target.value, 1); }
                    }}
                    className="field-input"
                  >
                    <option value="">Select team…</option>
                    {globalTeams.filter(t => t.name !== form.team2_name).map(t => (
                      <option key={t.id} value={t.name}>{t.is_guest ? `${t.name} ★` : t.name}</option>
                    ))}
                    <option value="__other__">Other / New team…</option>
                  </select>
                  {team1Other && (
                    <input
                      autoFocus
                      value={form.team1_name}
                      onChange={e => set({ team1_name: e.target.value })}
                      placeholder="Type new team name"
                      className="field-input mt-1.5"
                    />
                  )}
                </>
              ) : (
                <input value={form.team1_name} onChange={e => set({ team1_name: e.target.value })} className="field-input" />
              )}
            </div>
            <div>
              <label className="field-label">Team 2 name</label>
              {tournamentTeams.length > 0 ? (
                <select value={form.team2_name} onChange={e => { set({ team2_name: e.target.value }); applyGuestTeam(e.target.value, 2); }} className="field-input">
                  {tournamentTeams.filter(t => t.name !== form.team1_name).map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              ) : globalTeams.length > 0 ? (
                <>
                  <select
                    value={team2Other ? '__other__' : form.team2_name}
                    onChange={e => {
                      if (e.target.value === '__other__') { setTeam2Other(true); set({ team2_name: '' }); }
                      else { setTeam2Other(false); set({ team2_name: e.target.value }); applyGuestTeam(e.target.value, 2); }
                    }}
                    className="field-input"
                  >
                    <option value="">Select team…</option>
                    {globalTeams.filter(t => t.name !== form.team1_name).map(t => (
                      <option key={t.id} value={t.name}>{t.is_guest ? `${t.name} ★` : t.name}</option>
                    ))}
                    <option value="__other__">Other / New team…</option>
                  </select>
                  {team2Other && (
                    <input
                      autoFocus
                      value={form.team2_name}
                      onChange={e => set({ team2_name: e.target.value })}
                      placeholder="Type new team name"
                      className="field-input mt-1.5"
                    />
                  )}
                </>
              ) : (
                <input value={form.team2_name} onChange={e => set({ team2_name: e.target.value })} className="field-input" />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Total overs (1–100)</label>
              <input type="number" min={1} max={100} value={form.total_overs} onChange={e => set({ total_overs: e.target.value === '' ? '' : Number(e.target.value) })} className="field-input tabular-nums" />
            </div>
            <div>
              <label className="field-label">Team size (6–11)</label>
              <input type="number" min={6} max={11} value={form.team_size} onChange={e => set({ team_size: e.target.value === '' ? '' : Number(e.target.value) })} className="field-input tabular-nums" />
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <TeamSelector
            teamLabel={form.team1_name}
            players={players}
            selectedIds={form.team1Ids}
            onToggle={id => toggleTeam(1, id)}
            disabledIds={[...form.team2Ids, ...(form.jokerId ? [form.jokerId] : [])]}
            onQuickAdd={name => handleQuickAddPlayer(1, name)}
            targetSize={Number(form.team_size) || 0}
          />
          {form.team1Ids.length > 0 && (
            <div className="px-1 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                  {form.team1_name} — Captain
                </label>
                <select
                  value={form.team1CaptainId || ''}
                  onChange={e => set({ team1CaptainId: e.target.value || null })}
                  className="field-input"
                >
                  <option value="">Select captain *</option>
                  {form.team1Ids.map(id => {
                    const p = players.find(pl => pl.id === id);
                    return p ? <option key={id} value={id}>{p.name}</option> : null;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                  {form.team1_name} — Wicket Keeper
                </label>
                <select
                  value={form.team1KeeperId || ''}
                  onChange={e => set({ team1KeeperId: e.target.value || null })}
                  className="field-input"
                >
                  <option value="">Select keeper (optional)</option>
                  {form.team1Ids.map(id => {
                    const p = players.find(pl => pl.id === id);
                    return p ? <option key={id} value={id}>{p.name}</option> : null;
                  })}
                </select>
              </div>
            </div>
          )}

          <TeamSelector
            teamLabel={form.team2_name}
            players={players}
            selectedIds={form.team2Ids}
            onToggle={id => toggleTeam(2, id)}
            disabledIds={[...form.team1Ids, ...(form.jokerId ? [form.jokerId] : [])]}
            onQuickAdd={name => handleQuickAddPlayer(2, name)}
            targetSize={Number(form.team_size) || 0}
          />
          {form.team2Ids.length > 0 && (
            <div className="px-1 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                  {form.team2_name} — Captain
                </label>
                <select
                  value={form.team2CaptainId || ''}
                  onChange={e => set({ team2CaptainId: e.target.value || null })}
                  className="field-input"
                >
                  <option value="">Select captain *</option>
                  {form.team2Ids.map(id => {
                    const p = players.find(pl => pl.id === id);
                    return p ? <option key={id} value={id}>{p.name}</option> : null;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">
                  {form.team2_name} — Wicket Keeper
                </label>
                <select
                  value={form.team2KeeperId || ''}
                  onChange={e => set({ team2KeeperId: e.target.value || null })}
                  className="field-input"
                >
                  <option value="">Select keeper (optional)</option>
                  {form.team2Ids.map(id => {
                    const p = players.find(pl => pl.id === id);
                    return p ? <option key={id} value={id}>{p.name}</option> : null;
                  })}
                </select>
              </div>
            </div>
          )}

          <div className="card p-4 space-y-3">
            <div>
              <h4 className="text-[15px] font-bold text-ink-900 dark:text-white flex items-center gap-1.5">
                <Star size={14} className="text-cricket-gold fill-cricket-gold" /> Joker
              </h4>
              <p className="text-xs text-ink-400 mt-0.5">Optional — covers a missing player for either side</p>
            </div>
            {form.jokerId ? (
              (() => {
                const joker = players.find(p => p.id === form.jokerId);
                if (!joker) return null;
                return (
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-ink-50 dark:bg-white/[0.06] border border-ink-200 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <PlayerAvatar name={joker.name} photoUrl={joker.photo_url} size={28} />
                      <span className="text-sm font-medium text-ink-800 dark:text-white">{joker.name}</span>
                    </div>
                    <button type="button" onClick={() => set({ jokerId: null })} className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-red-500">
                      <X size={14} /> Remove
                    </button>
                  </div>
                );
              })()
            ) : (
              <PlayerSearch
                players={players}
                selectedIds={[]}
                onToggle={id => set({ jokerId: id })}
                disabledIds={[...form.team1Ids, ...form.team2Ids]}
                onQuickAdd={async name => {
                  const player = await addPlayer({ name });
                  set({ jokerId: player.id });
                  toast.success(`${player.name} added`);
                }}
              />
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card p-4 space-y-5">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-700 dark:text-ink-100">
            <Settings2 size={15} className="text-ink-500" /> Match Rules
          </div>
          <TossSetup team1Name={form.team1_name} team2Name={form.team2_name} value={form} onChange={v => set(v)} />
          <div className="space-y-2.5 pt-1">
            <label className="flex items-center gap-2.5 text-sm text-ink-700 dark:text-ink-100">
              <input type="checkbox" checked={form.last_man_standing} onChange={e => set({ last_man_standing: e.target.checked })} className="w-4 h-4 rounded accent-cricket-green" />
              Last man standing
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink-700 dark:text-ink-100">
              <input type="checkbox" checked={form.super_over_enabled} onChange={e => set({ super_over_enabled: e.target.checked })} className="w-4 h-4 rounded accent-cricket-green" />
              Enable super over on tie
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink-700 dark:text-ink-100">
              <input type="checkbox" checked={form.free_hit_on_no_ball} onChange={e => set({ free_hit_on_no_ball: e.target.checked })} className="w-4 h-4 rounded accent-cricket-green" />
              Free hit on no ball
            </label>
          </div>
          <div>
            <label className="field-label">Max overs per bowler (optional)</label>
            <input type="number" min={1} value={form.max_overs_per_bowler} onChange={e => set({ max_overs_per_bowler: e.target.value })} className="field-input tabular-nums" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Powerplay start over</label>
              <input type="number" min={1} value={form.powerplay_start} onChange={e => set({ powerplay_start: e.target.value })} className="field-input tabular-nums" />
            </div>
            <div>
              <label className="field-label">Powerplay end over</label>
              <input type="number" min={1} value={form.powerplay_end} onChange={e => set({ powerplay_end: e.target.value })} className="field-input tabular-nums" />
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-700 dark:text-ink-100">
            <ClipboardCheck size={15} className="text-ink-500" /> Review &amp; Start
          </div>
          <div className="flex items-center justify-center gap-4 py-2">
            <span className="text-base font-bold text-ink-800 dark:text-white">{form.team1_name}</span>
            <span className="text-xs font-semibold text-ink-400 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10">VS</span>
            <span className="text-base font-bold text-ink-800 dark:text-white">{form.team2_name}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 py-2.5">
              <div className="text-lg font-bold text-brand tabular-nums">{form.total_overs}</div>
              <div className="text-[11px] text-ink-400">Overs</div>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-white/5 py-2.5">
              <div className="text-lg font-bold text-brand tabular-nums">{form.team_size}</div>
              <div className="text-[11px] text-ink-400">Players / side</div>
            </div>
          </div>
          <p className="text-sm text-ink-500 dark:text-ink-100 text-center">
            <Users2 size={14} className="inline -mt-0.5 mr-1" />
            {form.toss_winner === 'team1' ? form.team1_name : form.team2_name} won the toss, chose to {form.toss_decision}
          </p>
          {form.jokerId && (() => {
            const joker = players.find(p => p.id === form.jokerId);
            return joker ? (
              <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-cricket-gold/10 border border-cricket-gold/30">
                <Star size={13} className="text-cricket-gold fill-cricket-gold flex-shrink-0" />
                <span className="text-sm text-ink-700 dark:text-ink-100">
                  Joker: <strong>{joker.name}</strong>
                </span>
              </div>
            ) : null;
          })()}
          <button onClick={handleStart} className="btn-primary w-full text-base">
            Start Match
          </button>
        </div>
      )}

      <div className="fixed bottom-16 left-0 right-0 bg-white/90 dark:bg-ink-900/90 backdrop-blur-md border-t border-gray-100 dark:border-white/5 px-3 pt-2 pb-3 max-w-2xl mx-auto">
        {!canNext && step === 1 && (() => {
          const size = Number(form.team_size);
          const msgs = [];
          const minPer = form.jokerId ? size - 1 : size;
          const t1have = form.team1Ids.length;
          const t2have = form.team2Ids.length;
          if (t1have < minPer) msgs.push(`${form.team1_name}: ${minPer - t1have} more player${minPer - t1have !== 1 ? 's' : ''} needed`);
          if (t2have < minPer) msgs.push(`${form.team2_name}: ${minPer - t2have} more player${minPer - t2have !== 1 ? 's' : ''} needed`);
          if (form.team1Ids.some(id => form.team2Ids.includes(id))) msgs.push('A player appears on both teams');
          return msgs.length > 0 ? (
            <p className="text-xs text-red-500 text-center mb-2">{msgs.join(' · ')}</p>
          ) : null;
        })()}
        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-secondary flex-1">
              Back
            </button>
          )}
          {step < 3 && (
            <button disabled={!canNext} onClick={() => setStep(s => s + 1)} className="btn-primary flex-1">
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
