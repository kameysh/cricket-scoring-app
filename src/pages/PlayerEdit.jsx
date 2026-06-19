import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import PlayerForm from '../components/player/PlayerForm';
import * as playerService from '../services/playerService';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';

export default function PlayerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editPlayer = usePlayerStore(s => s.editPlayer);
  const [player, setPlayer] = useState(null);
  const [appUsers, setAppUsers] = useState([]);
  const { canManagePlayers, userId } = useRole();
  const authLoading = useAuthStore(s => s.loading);

  useEffect(() => {
    if (authLoading) return;
    playerService.getPlayer(id).then(p => {
      if (!p) { navigate('/', { replace: true }); return; }
      const isOwnProfile = p.user_id && p.user_id === userId;
      if (!canManagePlayers && !isOwnProfile) { navigate('/', { replace: true }); return; }
      setPlayer(p);

      // For guest or unlinked players, load users available to link
      if (canManagePlayers && !p.user_id) {
        Promise.all([
          supabase.from('app_users').select('id, full_name, email').order('full_name'),
          supabase.from('players').select('user_id').not('user_id', 'is', null),
        ]).then(([{ data: users }, { data: linked }]) => {
          if (!users) return;
          const linkedIds = new Set((linked || []).map(r => r.user_id));
          setAppUsers(users.filter(u => !linkedIds.has(u.id)));
        });
      }
    });
  }, [id, authLoading, userId, canManagePlayers]);

  async function handleSubmit(data, photoFile) {
    try {
      let photo_url = player.photo_url;
      if (photoFile) photo_url = await playerService.uploadPlayerPhoto(photoFile, id);
      await editPlayer(id, { ...data, photo_url });
      toast.success('Player updated');
      navigate(`/players/${id}`);
    } catch (e) {
      toast.error(e.message || 'Failed to update player');
    }
  }

  if (!player) return null;

  const isOwnProfile = player.user_id && player.user_id === userId;

  return (
    <div className="p-4 page-transition">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        {isOwnProfile && !canManagePlayers ? 'Edit My Profile' : 'Edit Player'}
      </h1>
      <PlayerForm
        initial={player}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        appUsers={canManagePlayers ? appUsers : []}
        isAdmin={canManagePlayers}
      />
    </div>
  );
}
