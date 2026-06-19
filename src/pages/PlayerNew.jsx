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

  // Admin path: unlinked player-role users for optional linking
  const [appUsers, setAppUsers] = useState([]);

  // ── Player-role: check for existing profile ──
  useEffect(() => {
    if (!isPlayer || !userId) { setPhase('ready'); return; }

    playerService.getPlayerByUserId(userId).then(existing => {
      if (existing) {
        toast('You already have a player profile.', { icon: 'ℹ️' });
        navigate(`/players/${existing.id}`, { replace: true });
        return;
      }
      // No linked profile found — show "ask admin" message
      setPhase('no_profile');
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

  // ── No linked profile — ask admin to link ──
  if (phase === 'no_profile') {
    return (
      <div className="p-4 page-transition">
        <div className="flex flex-col items-center text-center gap-4 mt-8">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
            <UserCheck size={32} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-900 dark:text-white">No profile linked yet</h1>
            <p className="text-sm text-ink-500 mt-2 leading-relaxed">
              Ask your admin to create your player profile and link it to your account
              (<span className="font-medium text-ink-700 dark:text-ink-300">{user?.email}</span>).
            </p>
          </div>
          <div className="w-full p-4 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-100 dark:border-white/10 text-left text-sm text-ink-500 space-y-1">
            <p className="font-semibold text-ink-700 dark:text-ink-300">How it works</p>
            <p>1. Admin goes to Players → Add Player</p>
            <p>2. Fills in your cricket details</p>
            <p>3. Selects your email in "Link to user account"</p>
            <p>4. Your profile will appear here automatically</p>
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
        isAdmin={canManagePlayers}
      />
    </div>
  );
}
