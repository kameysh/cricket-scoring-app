import { useState } from 'react';
import toast from 'react-hot-toast';
import { Camera } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';

const MAX_BYTES = 8 * 1024 * 1024;

export default function PhotoUploader({ name, value, onChange }) {
  const [preview, setPreview] = useState(value || null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error('Photo must be 8MB or smaller');
      return;
    }
    setPreview(URL.createObjectURL(file));
    onChange(file);
  }

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        <img src={preview} alt={name} className="w-20 h-20 rounded-full object-cover" />
      ) : (
        <PlayerAvatar name={name} size={80} />
      )}
      <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
        <Camera size={16} />
        Upload photo
        <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </label>
    </div>
  );
}
