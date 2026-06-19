import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PhotoUploader from './PhotoUploader';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  role: z.string().optional(),
  batting_style: z.string().optional(),
  bowling_style: z.string().optional(),
});

// appUsers: [{ id, full_name, email }] — shown only on admin create/edit path
// isAdmin: show guest toggle + link dropdown
export default function PlayerForm({ initial, onSubmit, submitLabel = 'Save Player', appUsers = [], isAdmin = false }) {
  const [photoFile, setPhotoFile] = useState(null);
  const [linkedUserId, setLinkedUserId] = useState('');
  const [isGuest, setIsGuest] = useState(initial?.is_guest ?? false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initial || { name: '', role: '', batting_style: '', bowling_style: '' },
  });

  return (
    <form
      onSubmit={handleSubmit(data => onSubmit({
        ...data,
        is_guest: isGuest,
        user_id: linkedUserId || undefined,
        // clear guest flag when linking to a real account
        ...(linkedUserId ? { is_guest: false } : {}),
      }, photoFile))}
      className="space-y-4"
    >
      <PhotoUploader name={initial?.name || 'New Player'} value={initial?.photo_url} onChange={setPhotoFile} />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
        <input
          {...register('name')}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-cricket-green focus:outline-none"
          placeholder="Player name"
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
        <select {...register('role')} className="field-input">
          <option value="">Select role</option>
          <option value="batsman">Batsman</option>
          <option value="bowler">Bowler</option>
          <option value="allrounder">All-rounder</option>
          <option value="wicket_keeper">Wicket Keeper</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batting style</label>
        <select {...register('batting_style')} className="field-input">
          <option value="">Select</option>
          <option value="right-hand">Right-hand bat</option>
          <option value="left-hand">Left-hand bat</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bowling style</label>
        <select {...register('bowling_style')} className="field-input">
          <option value="">Select</option>
          <option value="right-arm-fast">Right-arm fast</option>
          <option value="right-arm-medium">Right-arm medium</option>
          <option value="right-arm-spin">Right-arm spin</option>
          <option value="left-arm-fast">Left-arm fast</option>
          <option value="left-arm-medium">Left-arm medium</option>
          <option value="left-arm-spin">Left-arm spin</option>
          <option value="none">Does not bowl</option>
        </select>
      </div>

      {isAdmin && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-ink-50 dark:bg-white/5 border border-ink-100 dark:border-white/10">
          <div>
            <p className="text-sm font-medium text-ink-700 dark:text-ink-200">Guest player</p>
            <p className="text-xs text-ink-400 mt-0.5">No app account — playing as a guest</p>
          </div>
          <button
            type="button"
            onClick={() => { setIsGuest(v => !v); if (!isGuest) setLinkedUserId(''); }}
            className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${isGuest ? 'bg-brand-green' : 'bg-ink-200 dark:bg-white/20'}`}
          >
            <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transition-transform ${isGuest ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      )}

      {isAdmin && !isGuest && appUsers.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Link to user account <span className="text-ink-400 font-normal">(optional)</span>
          </label>
          <select
            value={linkedUserId}
            onChange={e => setLinkedUserId(e.target.value)}
            className="field-input"
          >
            <option value="">— Not linked —</option>
            {appUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.full_name || u.email} ({u.email})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-400">
            Link this player to an invited user so they can manage their own profile.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary w-full"
      >
        {submitLabel}
      </button>
    </form>
  );
}
