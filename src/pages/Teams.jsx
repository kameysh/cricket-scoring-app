import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Users2 } from 'lucide-react';
import * as teamService from '../services/teamService';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import ConfirmDialog from '../components/shared/ConfirmDialog';

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    teamService.listTeams().then(setTeams).finally(() => setLoading(false));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    const name = newName.trim();
    if (name.length < 2) { toast.error('Team name must be at least 2 characters'); return; }
    if (teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A team with that name already exists'); return;
    }
    setAdding(true);
    try {
      const team = await teamService.addTeam(name);
      setTeams(prev => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      toast.success(`"${team.name}" added`);
    } catch (err) {
      toast.error(err.message || 'Failed to add team');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await teamService.deleteTeam(deleteTarget.id);
      setTeams(prev => prev.filter(t => t.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.name}" removed`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.message || 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Teams</h1>
        <span className="text-xs text-ink-400">{teams.length} team{teams.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : teams.length === 0 ? (
        <EmptyState icon={Users2} title="No teams yet" message="Add teams so they auto-populate in match and tournament setup." />
      ) : (
        <div className="space-y-2">
          {teams.map(t => (
            <div key={t.id} className="card p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center">
                  <Users2 size={15} className="text-brand-green" />
                </span>
                <span className="font-medium text-ink-900 dark:text-white">{t.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(t)}
                className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                aria-label={`Delete ${t.name}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add team form */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="New team name"
          className="field-input flex-1"
          maxLength={40}
        />
        <button
          type="submit"
          disabled={adding || newName.trim().length < 2}
          className="btn-primary !py-2 !px-4 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={16} /> Add
        </button>
      </form>
      <p className="text-xs text-ink-400">Teams added here will appear as suggestions when setting up matches and tournaments.</p>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete team"
        message={`Remove "${deleteTarget?.name}" from the teams list? This won't affect existing matches.`}
        confirmLabel="Delete"
        variant="danger"
        disabled={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
