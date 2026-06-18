import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import PlayerForm from '../components/player/PlayerForm';
import * as playerService from '../services/playerService';
import { usePlayerStore } from '../stores/playerStore';

export default function PlayerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editPlayer = usePlayerStore(s => s.editPlayer);
  const [player, setPlayer] = useState(null);

  useEffect(() => { playerService.getPlayer(id).then(setPlayer); }, [id]);

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

  return (
    <div className="p-4 page-transition">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Edit Player</h1>
      <PlayerForm initial={player} onSubmit={handleSubmit} submitLabel="Save Changes" />
    </div>
  );
}
