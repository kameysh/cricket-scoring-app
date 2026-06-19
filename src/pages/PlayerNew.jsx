import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PlayerForm from '../components/player/PlayerForm';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { useRole } from '../hooks/useRole';
import * as playerService from '../services/playerService';

export default function PlayerNew() {
  const navigate = useNavigate();
  const addPlayer = usePlayerStore(s => s.addPlayer);
  const user = useAuthStore(s => s.user);
  const { isPlayer, userId } = useRole();
  const [checking, setChecking] = useState(isPlayer); // guard for player-role duplicate check

  // Guard: player-role users who already have a profile should not create another
  useEffect(() => {
    if (!isPlayer || !userId) { setChecking(false); return; }
    playerService.getPlayerByUserId(userId).then(existing => {
      if (existing) {
        toast('You already have a player profile.', { icon: 'ℹ️' });
        navigate(`/players/${existing.id}`, { replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [isPlayer, userId]);

  // Pre-fill name for player role from their auth profile
  const initialData = isPlayer
    ? { name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '' }
    : undefined;

  async function handleSubmit(data, photoFile) {
    try {
      // For player role: attach their user_id so only they can edit this record
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

  if (checking) return null; // brief flash-free wait while checking

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
      <PlayerForm initial={initialData} onSubmit={handleSubmit} submitLabel={isPlayer ? 'Create My Profile' : 'Add Player'} />
    </div>
  );
}
