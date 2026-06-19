import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Search, Users, SlidersHorizontal, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlayerStore } from '../stores/playerStore';
import { useRole } from '../hooks/useRole';
import { useAuthStore } from '../stores/authStore';
import * as playerService from '../services/playerService';
import PlayerCarousel from '../components/player/PlayerCarousel';
import LoadingSkeleton from '../components/shared/LoadingSkeleton';
import EmptyState from '../components/shared/EmptyState';
import ConfirmDialog from '../components/shared/ConfirmDialog';

const ROLE_LABELS = {
  batsman: 'Batsman',
  bowler: 'Bowler',
  allrounder: 'All-rounder',
  wicket_keeper: 'Wicket Keeper',
};

const BATTING_LABELS  = { 'right-hand': 'Right-hand bat', 'left-hand': 'Left-hand bat' };
const BOWL_HAND_LABELS = { right: 'Right-arm', left: 'Left-arm' };
const BOWL_TYPE_LABELS = { fast: 'Fast', medium: 'Medium', spin: 'Spin' };

function getBowlHand(s) {
  if (!s) return null;
  return s.startsWith('right-arm') ? 'right' : s.startsWith('left-arm') ? 'left' : null;
}
function getBowlType(s) {
  if (!s) return null;
  return s.endsWith('fast') ? 'fast' : s.endsWith('medium') ? 'medium' : s.endsWith('spin') ? 'spin' : null;
}

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
      active ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900' : 'bg-ink-100 dark:bg-white/10 text-ink-600 dark:text-ink-300'
    }`}>{label}</button>
  );
}

export default function Players() {
  const navigate = useNavigate();
  const { players, loading, fetchPlayers, removeAllPlayers, removePlayer } = usePlayerStore();
  const { canManagePlayers, isAdmin, isPlayer, userId } = useRole();
  const user = useAuthStore(s => s.user);
  const isSuperAdmin = isAdmin && user?.email === 'kameshwaran26@gmail.com';
  const [myPlayer, setMyPlayer] = useState(undefined);
  const [statsMap, setStatsMap] = useState({});
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [battingFilter, setBattingFilter] = useState('');
  const [bowlHandFilter, setBowlHandFilter] = useState('');
  const [bowlTypeFilter, setBowlTypeFilter] = useState('');
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletePlayerTarget, setDeletePlayerTarget] = useState(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);

  useEffect(() => {
    fetchPlayers();
    playerService.getAllCareerStats().then(rows => {
      const map = {};
      rows.forEach(r => { map[r.player_id] = r; });
      setStatsMap(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (isPlayer && userId) playerService.getPlayerByUserId(userId).then(setMyPlayer);
  }, [isPlayer, userId]);

  useEffect(() => { setActiveCarouselIndex(0); }, [search, roleFilter, battingFilter, bowlHandFilter, bowlTypeFilter]);

  const activeFilterCount = [roleFilter, battingFilter, bowlHandFilter, bowlTypeFilter].filter(Boolean).length;

  const filtered = players.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter && p.role !== roleFilter) return false;
    if (battingFilter && p.batting_style !== battingFilter) return false;
    if (bowlHandFilter && getBowlHand(p.bowling_style) !== bowlHandFilter) return false;
    if (bowlTypeFilter && getBowlType(p.bowling_style) !== bowlTypeFilter) return false;
    return true;
  });

  async function handleDeletePlayer() {
    if (!deletePlayerTarget) return;
    setDeletingPlayer(true);
    try {
      const result = await removePlayer(deletePlayerTarget.id);
      setDeletePlayerTarget(null);
      toast.success(result.softDeleted
        ? `${deletePlayerTarget.name} deactivated (has match history)`
        : `${deletePlayerTarget.name} deleted`);
    } catch (e) {
      toast.error(e.message || 'Failed to delete player');
    } finally {
      setDeletingPlayer(false);
    }
  }

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

  return (
    <div className="p-4 flex flex-col gap-3 page-transition" style={{ minHeight: 'calc(100dvh - 72px)' }}>
      {/* Header */}
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
          <button onClick={() => setShowFilters(v => !v)}
            className={`relative flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              showFilters || activeFilterCount
                ? 'bg-ink-900 dark:bg-white text-white dark:text-ink-900'
                : 'bg-ink-100 dark:bg-white/10 text-ink-700 dark:text-ink-200'
            }`}>
            <SlidersHorizontal size={14} /> Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-brand-green text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          {isSuperAdmin && players.length > 0 && (
            <button onClick={() => setDeleteAllOpen(true)} title="Delete all players"
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
              <Trash2 size={17} />
            </button>
          )}
          {(canManagePlayers || (isPlayer && myPlayer === null)) && (
            <button onClick={() => navigate('/players/new')} className="btn-chip">
              <Plus size={16} /> {isPlayer && !canManagePlayers ? 'My Profile' : 'Add'}
            </button>
          )}
        </div>
      </div>

      {/* Player role banners */}
      {isPlayer && myPlayer === null && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-brand-green/10 border border-brand-green/30">
          <div>
            <p className="text-sm font-semibold text-brand-green">You haven't set up your player profile yet</p>
            <p className="text-xs text-ink-500 mt-0.5">Add your cricket details to appear in the players list.</p>
          </div>
          <button onClick={() => navigate('/players/new')}
            className="shrink-0 ml-3 text-sm font-semibold text-white bg-brand-green px-3 py-1.5 rounded-lg">
            Set up →
          </button>
        </div>
      )}
      {isPlayer && myPlayer && (
        <Link to={`/players/${myPlayer.id}`}
          className="flex items-center justify-between p-3 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-100 dark:border-white/10">
          <p className="text-sm font-medium text-ink-700 dark:text-ink-200">My profile: <span className="font-semibold">{myPlayer.name}</span></p>
          <span className="text-xs text-brand-green font-semibold">View →</span>
        </Link>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search players…" className="field-input !pl-10" />
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wide">Filters</span>
            {activeFilterCount > 0 && (
              <button onClick={() => { setRoleFilter(''); setBattingFilter(''); setBowlHandFilter(''); setBowlTypeFilter(''); }}
                className="flex items-center gap-1 text-xs text-red-500"><X size={12} /> Clear all</button>
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

      {/* Carousel — flex-1 fills remaining height and centers the cards */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No players found"
            message={activeFilterCount ? 'Try adjusting your filters.' : 'Add players to start building your squad.'} />
        ) : (
          <div className="overflow-hidden w-full -mx-4 px-4">
            <PlayerCarousel
              players={filtered}
              activeIndex={activeCarouselIndex}
              onChangeIndex={setActiveCarouselIndex}
              onSelect={id => navigate(`/players/${id}`)}
              statsMap={statsMap}
            />
          </div>
        )}
      </div>

      <ConfirmDialog open={!!deletePlayerTarget} danger
        title={`Delete ${deletePlayerTarget?.name}?`}
        message={`This will permanently remove ${deletePlayerTarget?.name}. If they have match history they will be deactivated instead.`}
        confirmLabel={deletingPlayer ? 'Deleting…' : 'Delete'}
        onConfirm={handleDeletePlayer} onCancel={() => setDeletePlayerTarget(null)} />
      <ConfirmDialog open={deleteAllOpen} danger
        title="Delete all players?"
        message={`This will remove all ${players.length} player${players.length !== 1 ? 's' : ''}. Players with match history will be deactivated instead.`}
        confirmLabel={deletingAll ? 'Deleting…' : 'Delete All'}
        onConfirm={handleDeleteAll} onCancel={() => setDeleteAllOpen(false)} />
    </div>
  );
}
