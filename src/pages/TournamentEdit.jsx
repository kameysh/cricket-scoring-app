import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Trash2, Plus, Check, X } from 'lucide-react';
import * as tournamentService from '../services/tournamentService';
import * as venueService from '../services/venueService';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { useRole } from '../hooks/useRole';

const MAX_TEAMS = 8;
const MIN_TEAMS = 2;

export default function TournamentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManageTournaments } = useRole();
  if (!canManageTournaments) { navigate('/'); return null; }
  const [form, setForm] = useState(null);
  const [venues, setVenues] = useState([]);
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [editingTeam, setEditingTeam] = useState(null); // { id, name }
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    tournamentService.getTournament(id).then(setForm);
    tournamentService.getTournamentTeams(id).then(setTeams);
    venueService.listVenues().then(setVenues);
  }, [id]);

  async function handleSave(e) {
    e.preventDefault();
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      toast.error('End date must be after start date'); return;
    }
    if (teams.length < MIN_TEAMS) { toast.error('Tournament needs at least 2 teams'); return; }
    setLoading(true);
    try {
      await tournamentService.updateTournament(id, {
        name: form.name,
        type: form.type,
        status: form.status,
        venue_id: form.venue_id || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        series_matches: form.series_matches || null,
      });
      toast.success('Tournament updated');
      navigate(`/tournaments/${id}`);
    } catch (e2) {
      toast.error(e2.message || 'Failed to update tournament');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTeam() {
    const name = newTeamName.trim();
    if (!name) return;
    if (teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Team name already exists'); return;
    }
    if (teams.length >= MAX_TEAMS) { toast.error('Maximum 8 teams allowed'); return; }
    try {
      const team = await tournamentService.addTournamentTeam(id, name);
      setTeams(ts => [...ts, team]);
      setNewTeamName('');
    } catch (e2) {
      toast.error(e2.message || 'Failed to add team');
    }
  }

  async function handleRenameTeam(teamId, newName) {
    const name = newName.trim();
    if (!name) return;
    if (teams.some(t => t.id !== teamId && t.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Team name already exists'); return;
    }
    try {
      const updated = await tournamentService.updateTournamentTeam(teamId, name);
      setTeams(ts => ts.map(t => t.id === teamId ? updated : t));
      setEditingTeam(null);
    } catch (e2) {
      toast.error(e2.message || 'Failed to rename team');
    }
  }

  async function handleDeleteTeam(team) {
    try {
      await tournamentService.deleteTournamentTeam(team.id, id, team.name);
      setTeams(ts => ts.filter(t => t.id !== team.id));
    } catch (e2) {
      toast.error(e2.message);
    }
  }

  async function handleDelete() {
    try {
      await tournamentService.deleteTournament(id);
      toast.success('Tournament deleted');
      navigate('/tournaments');
    } catch (e2) {
      toast.error(e2.message || 'Failed to delete tournament');
    }
  }

  if (!form) return null;
  const isUpcoming = form.status === 'upcoming';

  return (
    <div className="p-4 page-transition space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">Edit Tournament</h1>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="field-label">Tournament name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="field-input" />
        </div>

        <div>
          <label className="field-label">Format</label>
          <select
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value })}
            disabled={!isUpcoming}
            className="field-input disabled:opacity-50"
          >
            <option value="league">League (Round Robin)</option>
            <option value="knockout">Knockout</option>
            <option value="friendly">Friendly</option>
          </select>
          {!isUpcoming && <p className="text-xs text-ink-400 mt-1">Format cannot be changed once tournament has started</p>}
        </div>

        <div>
          <label className="field-label">Status</label>
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="field-input">
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="field-label">Venue</label>
          <select value={form.venue_id || ''} onChange={e => setForm({ ...form, venue_id: e.target.value })} className="field-input">
            <option value="">No venue</option>
            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Start date</label>
            <input type="date" value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} className="field-input" />
          </div>
          <div>
            <label className="field-label">End date</label>
            <input type="date" value={form.end_date || ''} onChange={e => setForm({ ...form, end_date: e.target.value })} className="field-input" />
          </div>
        </div>

        {teams.length === 2 && (
          <div>
            <label className="field-label">Series format</label>
            <div className="grid grid-cols-2 gap-2">
              {[3, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, series_matches: f.series_matches === n ? null : n }))}
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
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      {/* Teams Management */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Teams</h2>
          <span className="text-xs text-ink-400">{teams.length} / {MAX_TEAMS} · Min {MIN_TEAMS}</span>
        </div>

        <div className="space-y-2">
          {teams.map(team => (
            <div key={team.id} className="flex items-center gap-2">
              {editingTeam?.id === team.id ? (
                <>
                  <input
                    autoFocus
                    value={editingTeam.name}
                    onChange={e => setEditingTeam({ ...editingTeam, name: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRenameTeam(team.id, editingTeam.name); } if (e.key === 'Escape') setEditingTeam(null); }}
                    className="field-input flex-1 !py-1.5 text-sm"
                  />
                  <button type="button" onClick={() => handleRenameTeam(team.id, editingTeam.name)} className="p-1.5 rounded-lg bg-brand-green text-white">
                    <Check size={14} />
                  </button>
                  <button type="button" onClick={() => setEditingTeam(null)} className="p-1.5 rounded-lg border border-ink-200 dark:border-white/10">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setEditingTeam({ id: team.id, name: team.name })}
                    className="flex-1 text-left text-sm font-medium py-1.5 px-2 rounded-lg hover:bg-ink-50 dark:hover:bg-white/5"
                  >
                    {team.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTeam(team)}
                    disabled={teams.length <= MIN_TEAMS}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {teams.length < MAX_TEAMS && (
          <div className="flex gap-2 pt-1">
            <input
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTeam(); } }}
              placeholder="New team name"
              className="field-input flex-1 !py-1.5 text-sm"
            />
            <button type="button" onClick={handleAddTeam} className="px-3 py-1.5 rounded-lg bg-brand-green text-white text-sm font-semibold flex items-center gap-1">
              <Plus size={14} /> Add
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="w-full py-3 rounded-xl border border-red-300 text-red-600 font-semibold flex items-center justify-center gap-2"
      >
        <Trash2 size={16} /> Delete Tournament
      </button>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this tournament?"
        message="This will permanently delete the tournament and all its data. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
