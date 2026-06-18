import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PlayerForm from '../components/player/PlayerForm';
import { usePlayerStore } from '../stores/playerStore';
import * as playerService from '../services/playerService';

export default function PlayerNew() {
  const navigate = useNavigate();
  const addPlayer = usePlayerStore(s => s.addPlayer);

  async function handleSubmit(data, photoFile) {
    try {
      const player = await addPlayer(data);
      if (photoFile) {
        const url = await playerService.uploadPlayerPhoto(photoFile, player.id);
        await playerService.updatePlayer(player.id, { photo_url: url });
      }
      toast.success('Player added');
      navigate('/players');
    } catch (e) {
      toast.error(e.message || 'Failed to add player');
    }
  }

  return (
    <div className="p-4 page-transition">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Add Player</h1>
      <PlayerForm onSubmit={handleSubmit} submitLabel="Add Player" />
    </div>
  );
}
