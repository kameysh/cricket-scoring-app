import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Repeat2, Trash2, Pencil, Check, X } from 'lucide-react';
import * as seriesService from '../services/seriesService';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { useRole } from '../hooks/useRole';
import toast from 'react-hot-toast';

export default function Series() {
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // series obj
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    seriesService.listSeries()
      .then(setSeries)
      .catch(() => toast.error('Failed to load series'))
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const s = await seriesService.addSeries(name);
      setSeries(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setShowAdd(false);
      toast.success(`Series "${name}" created`);
    } catch (err) {
      toast.error(err.message?.includes('unique') ? 'A series with that name already exists.' : (err.message || 'Failed to create series'));
    } finally {
      setAdding(false);
    }
  }

  async function handleRename(s) {
    const name = editName.trim();
    if (!name || name === s.name) { setEditingId(null); return; }
    setSaving(true);
    try {
      const updated = await seriesService.updateSeries(s.id, name);
      setSeries(prev => prev.map(x => x.id === s.id ? updated : x).sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Renamed to "${updated.name}"`);
    } catch (err) {
      toast.error(err.message?.includes('unique') ? 'That name already exists.' : (err.message || 'Failed to rename'));
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  }

  async function handleDelete(s) {
    try {
      await seriesService.deleteSeries(s.id);
      setSeries(prev => prev.filter(x => x.id !== s.id));
      toast.success(`"${s.name}" deleted`);
    } catch (err) {
      toast.error(err.message || 'Failed to delete series');
    } finally {
      setConfirmDelete(null);
    }
  }

  return (
    <div className="p-4 space-y-4 page-transition">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Repeat2 size={18} className="text-brand-green" />
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">Tournament Series</h1>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(s => !s)} className="btn-chip">
            <Plus size={15} /> New
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && isAdmin && (
        <form onSubmit={handleAdd} className="card p-4 space-y-3 border border-brand-green/30">
          <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-100">New series name</h2>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. K7 Trophy"
            className="field-input"
            autoFocus
            required
          />
          <p className="text-xs text-ink-400">This becomes the recurring name. Each edition (Season 1, Season 2…) is a separate tournament that links to this series.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={adding || !newName.trim()} className="btn-primary flex-1 text-sm py-2">
              {adding ? 'Creating…' : 'Create Series'}
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setNewName(''); }} className="flex-1 py-2 rounded-lg border border-ink-200 dark:border-white/10 text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-ink-100 dark:bg-white/5 animate-pulse" />)}
        </div>
      ) : series.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Repeat2 size={36} className="mx-auto text-ink-300" />
          <p className="text-ink-500 dark:text-ink-400 text-sm">No series yet.</p>
          {isAdmin && <p className="text-xs text-ink-400">Tap "New" to create a recurring tournament series like "K7 Trophy".</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {series.map(s => (
            <div key={s.id} className="card p-3 flex items-center gap-3">
              {editingId === s.id ? (
                <>
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(s); if (e.key === 'Escape') setEditingId(null); }}
                    className="flex-1 field-input text-sm py-1.5"
                  />
                  <button
                    onClick={() => handleRename(s)}
                    disabled={saving || !editName.trim()}
                    className="p-1.5 rounded-lg text-brand-green hover:bg-brand-green/10 disabled:opacity-40"
                    aria-label="Save"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10"
                    aria-label="Cancel"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate(`/series/${s.id}`)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-green to-brand-teal flex items-center justify-center text-white font-bold text-base shrink-0">
                      {s.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{s.name}</p>
                      <p className="text-xs text-ink-400">Tap to view seasons &amp; stats</p>
                    </div>
                    <ChevronRight size={16} className="text-ink-300 shrink-0" />
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => { setEditingId(s.id); setEditName(s.name); }}
                        className="p-1.5 rounded-lg text-ink-300 hover:text-ink-700 dark:hover:text-white hover:bg-ink-100 dark:hover:bg-white/10 transition-colors shrink-0"
                        aria-label={`Rename ${s.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(s)}
                        className="p-1.5 rounded-lg text-ink-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                        aria-label={`Delete ${s.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        danger
        title="Delete series?"
        message={`"${confirmDelete?.name}" will be removed. Existing tournaments linked to this series will become one-off events (their data is kept).`}
        confirmLabel="Delete"
        onConfirm={() => handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
