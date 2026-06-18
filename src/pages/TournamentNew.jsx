import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import * as venueService from '../services/venueService';
import * as tournamentService from '../services/tournamentService';
import { useTournamentStore } from '../stores/tournamentStore';

const MAX_TEAMS = 8;
const MIN_TEAMS = 2;

export default function TournamentNew() {
  const navigate = useNavigate();
  const addTournament = useTournamentStore(s => s.addTournament);
  const [venues, setVenues] = useState([]);
  const [form, setForm] = useState({ name: '', type: 'league', venue_id: '', start_date: '', end_date: '', series_matches: '' });
  const [teams, setTeams] = useState(['', '']);
  const [loading, setLoading] = useState(false);

  useEffect(() => { venueService.listVenues().then(setVenues); }, []);

  function setTeamName(i, val) {
    setTeams(t => t.map((n, idx) => idx === i ? val : n));
  }

  function addTeam() {
    if (teams.length < MAX_TEAMS) setTeams(t => [...t, '']);
  }

  function removeTeam(i) {
    if (teams.length > MIN_TEAMS) setTeams(t => t.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.name.trim().length < 2) { toast.error('Tournament name is required'); return; }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      toast.error('End date must be after start date'); return;
    }
    const teamNames = teams.map(n => n.trim()).filter(Boolean);
    if (teamNames.length < MIN_TEAMS) { toast.error('Add at least 2 team names'); return; }
    const unique = new Set(teamNames.map(n => n.toLowerCase()));
    if (unique.size !== teamNames.length) { toast.error('Team names must be unique'); return; }

    setLoading(true);
    try {
      const t = await addTournament({
        ...form,
        venue_id: form.venue_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        series_matches: form.series_matches || null,
      });
      await Promise.all(teamNames.map(name => tournamentService.addTournamentTeam(t.id, name)));
      toast.success('Tournament created');
      navigate(`/tournaments/${t.id}/setup`);
    } catch (e2) {
      toast.error(e2.message || 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 page-transition">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Create Tournament</h1>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="field-label">Tournament name</label>
          <input placeholder="e.g. IPL 2026" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="field-input" />
        </div>

        <div>
          <label className="field-label">Format</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="field-input">
            <option value="league">League (Round Robin)</option>
            <option value="knockout">Knockout</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>

        <div>
          <label className="field-label">Venue (optional)</label>
          <select value={form.venue_id} onChange={e => setForm({ ...form, venue_id: e.target.value })} className="field-input">
            <option value="">No venue</option>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Start date</label>
            <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">End date</label>
            <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="field-input" />
          </div>
        </div>

        {/* Series format — only for 2-team tournaments */}
        {teams.filter(n => n.trim()).length === 2 && (
          <div>
            <label className="field-label">Series format</label>
            <div className="grid grid-cols-2 gap-2">
              {[3, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, series_matches: f.series_matches === n ? '' : n }))}
                  className={`py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                    form.series_matches === n
                      ? 'bg-brand-green text-white border-brand-green'
                      : 'border-ink-200 dark:border-white/10 text-ink-700 dark:text-ink-200'
                  }`}
                >
                  {`Best of ${n}`}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-400 mt-1">Best of 3 (2 wins to clinch) or Best of 5 (3 wins)</p>
          </div>
        )}

        {/* Teams */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="field-label !mb-0">Teams</label>
            <span className="text-xs text-ink-400">{teams.length} / {MAX_TEAMS} teams</span>
          </div>
          <div className="space-y-2">
            {teams.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={name}
                  onChange={e => setTeamName(i, e.target.value)}
                  placeholder={`Team ${i + 1} name`}
                  className="field-input flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeTeam(i)}
                  disabled={teams.length <= MIN_TEAMS}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          {teams.length < MAX_TEAMS && (
            <button type="button" onClick={addTeam} className="mt-2 flex items-center gap-1.5 text-sm font-medium text-brand-green dark:text-cricket-gold">
              <Plus size={15} /> Add Team
            </button>
          )}
          <p className="mt-1 text-xs text-ink-400">Min {MIN_TEAMS} · Max {MAX_TEAMS} teams</p>
        </div>

        {(() => {
          const filledTeams = teams.filter(n => n.trim()).length;
          const needsSeries = filledTeams === 2;
          const canSubmit = !loading && form.name.trim().length >= 2 && filledTeams >= MIN_TEAMS && (!needsSeries || !!form.series_matches);
          return (
            <button type="submit" disabled={!canSubmit} className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? 'Creating…' : 'Create Tournament'}
            </button>
          );
        })()}
      </form>
    </div>
  );
}
