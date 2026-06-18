import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, SlidersHorizontal, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlayerStore } from '../stores/playerStore';
import { useRole } from '../hooks/useRole';
import PlayerCard from '../components/player/PlayerCard';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const ROLE_LABELS = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  allrounder: 'All-rounder',
  wicket_keeper: 'Wicket Keeper',
};

const BATTING_LABELS = {
  'right-hand': 'Right-hand bat',
  'left-hand': 'Left-hand bat',
};

const BOWL_HAND_LABELS = {
  right: 'Right-arm',
  left: 'Left-arm',
};

const BOWL_TYPE_LABELS = {
  fast: 'Fast',
  medium: 'Medium',
  spin: 'Spin',
};

function getBowlHand(style) {
  if (!style) return null;
  if (style.startsWith('right-arm')) return 'right';
  if (style.startsWith('left-arm')) return 'left';
  return null;
}

function getBowlType(style) {
  if (!style) return null;
  if (style.endsWith('fast')) return 'fast';
  if (style.endsWith('medium')) return 'medium';
  if (style.endsWith('spin')) return 'spin';
  return null;
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900'
          : 'bg-ink-100 dark:bg-white/10 text-ink-600 dark:text-ink-300'
      }`}
    >
      {label}
    </button>
  );
}

export default function Players() {
  const navigate = useNavigate();
  const { players, loading, fetchPlayers, removeAllPlayers } = usePlayerStore();
  const { canManagePlayers, isAdmin } = useRole();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [battingFilter, setBattingFilter] = useState('');
  const [bowlHandFilter, setBowlHandFilter] = useState('');
  const [bowlTypeFilter, setBowlTypeFilter] = useState('');
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      await removeAllPlayers();
      setDeleteAllOpen(false);
      toast.success('All players removed');
    } catch (e) {
      toast.error(e.message || 'Failed to delete players');
    } finally {
      setDeletingAll(false);
    }
  }

  useEffect(() => { fetchPlayers(); }, []);

  const activeFilterCount = [roleFilter, battingFilter, bowlHandFilter, bowlTypeFilter].filter(Boolean).length;

  function clearAll() {
    setRoleFilter('');
    setBattingFilter('');
    setBowlHandFilter('');
    setBowlTypeFilter('');
  }

  const filtered = players.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && p.role !== roleFilter) return false;
    if (battingFilter && p.batting_style !== battingFilter) return false;
    if (bowlHandFilter && getBowlHand(p.bowling_style) !== bowlHandFilter) return false;
    if (bowlTypeFilter && getBowlType(p.bowling_style) !== bowlTypeFilter) return false;
    return true;
  });

  return (
    <div className="p-4 space-y-3 page-transition">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Players</h1>
          {!loading && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {activeFilterCount || search ? `${filtered.length} of ${players.length}` : players.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`relative flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              showFilters || activeFilterCount
                ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900'
                : 'bg-ink-100 dark:bg-white/10 text-ink-700 dark:text-ink-200'
            }`}
          >
            <SlidersHorizontal size={14} />
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-brand-green text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          {isAdmin && players.length > 0 && (
            <button onClick={() => setDeleteAllOpen(true)} className="btn-chip !text-red-500 !border-red-200 dark:!border-red-500/30">
              <Trash2 size={14} /> Delete All
            </button>
          )}
          {canManagePlayers && (
            <button onClick={() => navigate('/players/new')} className="btn-chip">
              <Plus size={16} /> Add
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players…" className="field-input !pl-10" />
      </div>

      {showFilters && (
        <div className="card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide">Filters</span>
            {activeFilterCount > 0 && (
              <button onClick={clearAll} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                <X size={12} /> Clear all
              </button>
            )}
          </div>

          <div>
            <p className="text-xs text-ink-400 mb-1.5">Role</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ROLE_LABELS).map(([val, label]) => (
                <FilterChip key={val} label={label} active={roleFilter === val} onClick={() => setRoleFilter(roleFilter === val ? '' : val)} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-ink-400 mb-1.5">Batting hand</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(BATTING_LABELS).map(([val, label]) => (
                <FilterChip key={val} label={label} active={battingFilter === val} onClick={() => setBattingFilter(battingFilter === val ? '' : val)} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-ink-400 mb-1.5">Bowling arm</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(BOWL_HAND_LABELS).map(([val, label]) => (
                <FilterChip key={val} label={label} active={bowlHandFilter === val} onClick={() => setBowlHandFilter(bowlHandFilter === val ? '' : val)} />
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-ink-400 mb-1.5">Bowling type</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(BOWL_TYPE_LABELS).map(([val, label]) => (
                <FilterChip key={val} label={label} active={bowlTypeFilter === val} onClick={() => setBowlTypeFilter(bowlTypeFilter === val ? '' : val)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No players found" message={activeFilterCount ? 'Try adjusting your filters.' : 'Add players to start building your squad.'} />
      ) : (
        <div className="space-y-2">{filtered.map(p => <PlayerCard key={p.id} player={p} />)}</div>
      )}

      <ConfirmDialog
        open={deleteAllOpen}
        danger
        title="Delete all players?"
        message={`This will remove all ${players.length} player${players.length !== 1 ? 's' : ''}. Players with match history will be deactivated instead of permanently deleted.`}
        confirmLabel={deletingAll ? 'Deleting…' : 'Delete All'}
        onConfirm={handleDeleteAll}
        onCancel={() => setDeleteAllOpen(false)}
      />
    </div>
  );
}
