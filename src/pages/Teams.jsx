import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, Users2, ChevronDown, ChevronUp, X, UserPlus, Pencil, Check } from 'lucide-react';
import * as teamService from '../services/teamService';
import * as playerService from '../services/playerService';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import PlayerAvatar from '../components/player/PlayerAvatar';

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [allPlayers, setAllPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newIsGuest, setNewIsGuest] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // editTarget: { id, oldName, value, saving }
  const [editTarget, setEditTarget] = useState(null);

  // Expanded team state: { [teamId]: { open, playerIds, search, saving } }
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    Promise.all([
      teamService.listTeams(),
      playerService.listPlayers({ activeOnly: true }),
    ]).then(([ts, ps]) => {
      setTeams(ts);
      setAllPlayers(ps || []);
    }).finally(() => setLoading(false));
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
      const team = await teamService.addTeam(name, newIsGuest);
      setTeams(prev => [...prev, team].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setNewIsGuest(false);
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

  async function toggleExpand(team) {
    const cur = expanded[team.id];
    if (cur?.open) {
      setExpanded(prev => ({ ...prev, [team.id]: { ...cur, open: false } }));
      return;
    }
    // Load players for this team
    try {
      const playerIds = await teamService.getTeamPlayers(team.id);
      setExpanded(prev => ({
        ...prev,
        [team.id]: { open: true, playerIds, search: '', saving: false },
      }));
    } catch (err) {
      toast.error('Failed to load team roster');
    }
  }

  async function togglePlayer(teamId, playerId) {
    const cur = expanded[teamId];
    if (!cur) return;
    const alreadyIn = cur.playerIds.includes(playerId);
    const newIds = alreadyIn
      ? cur.playerIds.filter(id => id !== playerId)
      : [...cur.playerIds, playerId];

    setExpanded(prev => ({ ...prev, [teamId]: { ...cur, playerIds: newIds, saving: true } }));
    try {
      await teamService.setTeamPlayers(teamId, newIds);
    } catch (err) {
      toast.error('Failed to update roster');
      setExpanded(prev => ({ ...prev, [teamId]: { ...cur, saving: false } }));
      return;
    }
    setExpanded(prev => ({ ...prev, [teamId]: { ...prev[teamId], saving: false } }));
  }

  async function handleRename(e) {
    e?.preventDefault();
    if (!editTarget) return;
    const newName = editTarget.value.trim();
    if (newName.length < 2) { toast.error('Name must be at least 2 characters'); return; }
    if (newName === editTarget.oldName) { setEditTarget(null); return; }
    if (teams.some(t => t.id !== editTarget.id && t.name.toLowerCase() === newName.toLowerCase())) {
      toast.error('A team with that name already exists'); return;
    }
    setEditTarget(e => ({ ...e, saving: true }));
    try {
      await teamService.updateTeamName(editTarget.id, editTarget.oldName, newName);
      setTeams(prev => prev.map(t => t.id === editTarget.id ? { ...t, name: newName } : t));
      toast.success(`Renamed to "${newName}" — all matches updated`);
      setEditTarget(null);
    } catch (err) {
      toast.error(err.message || 'Failed to rename team');
      setEditTarget(e => ({ ...e, saving: false }));
    }
  }

  return (
    <div className="p-4 space-y-4 page-transition">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Teams</h1>
        <span className="text-xs text-ink-400">{teams.length} team{teams.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Add team form */}
      <div className="space-y-2">
        <form onSubmit={handleAdd} className="flex items-center gap-2">
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

        {/* Guest toggle */}
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-sm font-medium text-ink-700 dark:text-ink-200">Guest team</p>
            <p className="text-xs text-ink-400">Auto-fill players when selected in match setup</p>
          </div>
          <button
            type="button"
            onClick={() => setNewIsGuest(v => !v)}
            className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${newIsGuest ? 'bg-brand-green' : 'bg-ink-200 dark:bg-white/20'}`}
          >
            <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transition-transform ${newIsGuest ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : teams.length === 0 ? (
        <EmptyState icon={Users2} title="No teams yet" message="Add teams so they auto-populate in match and tournament setup." />
      ) : (
        <div className="space-y-2">
          {teams.map(t => {
            const exp = expanded[t.id];
            const isOpen = exp?.open;
            return (
              <div key={t.id} className="card overflow-hidden">
                {/* Team row */}
                <div className="p-3 flex items-center gap-2">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-brand-green/10 flex items-center justify-center">
                    <Users2 size={15} className="text-brand-green" />
                  </span>

                  {editTarget?.id === t.id ? (
                    /* ── Rename mode ── */
                    <form onSubmit={handleRename} className="flex-1 flex items-center gap-1.5 min-w-0">
                      <input
                        autoFocus
                        value={editTarget.value}
                        onChange={e => setEditTarget(et => ({ ...et, value: e.target.value }))}
                        onKeyDown={e => e.key === 'Escape' && setEditTarget(null)}
                        className="field-input !py-1 !text-sm flex-1 min-w-0"
                        maxLength={40}
                      />
                      <button type="submit" disabled={editTarget.saving}
                        className="p-1.5 rounded-lg bg-brand-green/10 text-brand-green hover:bg-brand-green/20">
                        <Check size={15} />
                      </button>
                      <button type="button" onClick={() => setEditTarget(null)}
                        className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10">
                        <X size={15} />
                      </button>
                    </form>
                  ) : (
                    /* ── Normal mode ── */
                    <button
                      type="button"
                      onClick={() => toggleExpand(t)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      <span className="font-medium text-ink-900 dark:text-white truncate">{t.name}</span>
                      {t.is_guest && (
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                          Guest
                        </span>
                      )}
                      {isOpen ? <ChevronUp size={15} className="shrink-0 text-ink-400 ml-auto" /> : <ChevronDown size={15} className="shrink-0 text-ink-400 ml-auto" />}
                    </button>
                  )}

                  {editTarget?.id !== t.id && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setEditTarget({ id: t.id, oldName: t.name, value: t.name, saving: false }); }}
                      className="p-2 rounded-lg text-ink-400 hover:bg-ink-100 dark:hover:bg-white/10"
                      aria-label={`Rename ${t.name}`}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {editTarget?.id !== t.id && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(t)}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                      aria-label={`Delete ${t.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {/* Expanded player roster */}
                {isOpen && (
                  <div className="border-t border-ink-100 dark:border-white/10 px-3 pb-3 pt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide flex items-center gap-1.5">
                        <UserPlus size={12} /> Default Roster {exp.saving && <span className="text-brand-green">Saving…</span>}
                      </p>
                      {(() => {
                        const guestCount = allPlayers.filter(p => p.is_guest).length;
                        return (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [t.id]: { ...prev[t.id], guestOnly: !prev[t.id]?.guestOnly } })); }}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                              exp.guestOnly
                                ? 'bg-amber-500 text-white'
                                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            Guest {guestCount > 0 && <span>({guestCount})</span>}
                          </button>
                        );
                      })()}
                    </div>

                    {/* Search */}
                    <input
                      value={exp.search || ''}
                      onChange={e => setExpanded(prev => ({ ...prev, [t.id]: { ...prev[t.id], search: e.target.value } }))}
                      placeholder="Search players…"
                      className="field-input !py-1.5 !text-sm"
                    />

                    {/* Player list */}
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {allPlayers
                        .filter(p => !exp.guestOnly || p.is_guest)
                        .filter(p => !exp.search || p.name.toLowerCase().includes(exp.search.toLowerCase()))
                        .map(p => {
                          const selected = exp.playerIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => togglePlayer(t.id, p.id)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors ${
                                selected
                                  ? 'bg-brand-green/10 border border-brand-green/30'
                                  : 'hover:bg-ink-50 dark:hover:bg-white/5 border border-transparent'
                              }`}
                            >
                              <PlayerAvatar name={p.name} photoUrl={p.photo_url} size={28} />
                              <span className="flex-1 text-sm font-medium text-ink-900 dark:text-white truncate">{p.name}</span>
                              {p.is_guest && (
                                <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                  Guest
                                </span>
                              )}
                              {selected && (
                                <span className="shrink-0 w-4 h-4 rounded-full bg-brand-green flex items-center justify-center">
                                  <X size={9} className="text-white" strokeWidth={3} />
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>

                    {exp.playerIds.length > 0 && (
                      <p className="text-[11px] text-ink-400 text-center">
                        {exp.playerIds.length} player{exp.playerIds.length !== 1 ? 's' : ''} in default roster
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-ink-400">Teams added here will appear as suggestions when setting up matches and tournaments. Guest teams auto-fill their roster on selection.</p>

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
