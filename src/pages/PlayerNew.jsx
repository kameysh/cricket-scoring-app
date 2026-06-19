import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UserCheck } from 'lucide-react';
import PlayerForm from '../components/player/PlayerForm';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { useRole } from '../hooks/useRole';
import * as playerService from '../services/playerService';
import { supabase } from '../lib/supabase';

export default function PlayerNew() {
  const navigate = useNavigate();
  const addPlayer = usePlayerStore(s => s.addPlayer);
  const user = useAuthStore(s => s.user);
  const { isAdmin, isPlayer, userId, canManagePlayers } = useRole();

  // 'checking' | 'claim' | 'ready'
  const [phase, setPhase] = useState(isPlayer ? 'checking' : 'ready');
  const [claimCandidate, setClaimCandidate] = useState(null); // player row to claim
  const [claiming, setClaiming] = useState(false);

  // Admin path: unlinked player-role users for optional linking
  const [appUsers, setAppUsers] = useState([]);

  // ── Player-role: check for existing profile or claimable row ──
  useEffect(() => {
    if (!isPlayer || !userId) { setPhase('ready'); return; }

    playerService.getPlayerByUserId(userId).then(existing => {
      if (existing) {
        toast('You already have a player profile.', { icon: 'ℹ️' });
        navigate(`/players/${existing.id}`, { replace: true });
        return;
      }

      // Look for an unclaimed player whose name matches this user's full name
      const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
      if (!fullName) { setPhase('ready'); return; }

      supabase
        .from('players')
        .select('*')
        .is('user_id', null)
        .ilike('name', fullName.trim())
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setClaimCandidate(data);
            setPhase('claim');
          } else {
            setPhase('ready');
          }
        });
    });
  }, [isPlayer, userId]);

  // ── Admin path: load unlinked player-role users ──
  useEffect(() => {
    if (!canManagePlayers) return;
    // Load all users who don't already have a linked player row
    Promise.all([
      supabase.from('app_users').select('id, full_name, email').order('full_name'),
      supabase.from('players').select('user_id').not('user_id', 'is', null),
    ]).then(([{ data: users }, { data: linked }]) => {
      if (!users) return;
      const linkedIds = new Set((linked || []).map(r => r.user_id));
      setAppUsers(users.filter(u => !linkedIds.has(u.id)));
    });
  }, [canManagePlayers]);

  async function handleClaim() {
    setClaiming(true);
    try {
      const { error } = await supabase
        .from('players')
        .update({ user_id: userId })
        .eq('id', claimCandidate.id)
        .is('user_id', null);
      if (error) throw error;
      toast.success('Profile linked to your account!');
      navigate(`/players/${claimCandidate.id}`);
    } catch (e) {
      toast.error(e.message || 'Failed to claim profile');
    } finally {
      setClaiming(false);
    }
  }

  async function handleSubmit(data, photoFile) {
    try {
      // player-role: always bind to their own userId
      // admin: user_id comes from the optional link dropdown (may be undefined)
      const payload = isPlayer ? { ...data, user_id: userId } : data;
      const player = await addPlayer(payload);
      if (photoFile) {
        const url = await playerService.uploadPlayerPhoto(photoFile, player.id);
        await playerService.updatePlayer(player.id, { photo_url: url });
      }
      toast.success('Player added');
      navigate(`/players/${player.id}`);
    } catch (e) {
      toast.error(e.message || 'Failed to add player');
    }
  }

  if (phase === 'checking') return null;

  // ── Claim screen ──
  if (phase === 'claim' && claimCandidate) {
    return (
      <div className="p-4 page-transition">
        <div className="flex flex-col items-center text-center gap-4 mt-8">
          <div className="w-16 h-16 rounded-full bg-brand-green/10 flex items-center justify-center">
            <UserCheck size={32} className="text-brand-green" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-900 dark:text-white">Is this your profile?</h1>
            <p className="text-sm text-ink-500 mt-1">We found an existing player profile matching your name.</p>
          </div>

          <div className="w-full card p-4 text-left space-y-1.5">
            <p className="font-bold text-ink-900 dark:text-white text-lg">{claimCandidate.name}</p>
            {claimCandidate.role && (
              <p className="text-sm text-ink-500 capitalize">{claimCandidate.role.replace('_', ' ')}</p>
            )}
            {claimCandidate.batting_style && (
              <p className="text-xs text-ink-400">{claimCandidate.batting_style} · {claimCandidate.bowling_style || 'No bowling style'}</p>
            )}
          </div>

          <div className="w-full space-y-2">
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="btn-primary w-full disabled:opacity-50"
            >
              {claiming ? 'Linking…' : 'Yes, this is me — Link profile'}
            </button>
            <button
              onClick={() => setPhase('ready')}
              className="w-full py-2.5 rounded-xl border border-ink-200 dark:border-white/10 text-sm font-medium text-ink-600 dark:text-ink-300"
            >
              No, create a new profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Create form ──
  const initialData = isPlayer
    ? { name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '' }
    : undefined;

  return (
    <div className="p-4 page-transition">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        {isPlayer ? 'Set up your player profile' : 'Add Player'}
      </h1>
      {isPlayer && (
        <p className="text-sm text-ink-500 dark:text-ink-400 mb-4">
          Fill in your cricket details. You can edit this profile anytime.
        </p>
      )}
      <PlayerForm
        initial={initialData}
        onSubmit={handleSubmit}
        submitLabel={isPlayer ? 'Create My Profile' : 'Add Player'}
        appUsers={canManagePlayers ? appUsers : []}
      />
    </div>
  );
}
