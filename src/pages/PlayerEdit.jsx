import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import PlayerForm from '../components/player/PlayerForm';
import * as playerService from '../services/playerService';
import { usePlayerStore } from '../stores/playerStore';
import { useRole } from '../hooks/useRole';

export default function PlayerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editPlayer = usePlayerStore(s => s.editPlayer);
  const [player, setPlayer] = useState(null);
  const { canManagePlayers, userId } = useRole();

  useEffect(() => { playerService.getPlayer(id).then(setPlayer); }, [id]);

  // Wait until player loaded to run access check
  useEffect(() => {
    if (!player) return;
    const isOwnProfile = player.user_id && player.user_id === userId;
    if (!canManagePlayers && !isOwnProfile) {
      navigate('/', { replace: true });
    }
  }, [player, userId, canManagePlayers]);

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
      <PlayerForm initial={player} onSubmit={handleSubmit} submitLabel="Save Changes" />
    </div>
  );
}
