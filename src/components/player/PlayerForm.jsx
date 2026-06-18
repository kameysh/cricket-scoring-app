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

export default function PlayerForm({ initial, onSubmit, submitLabel = 'Save Player' }) {
  const [photoFile, setPhotoFile] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initial || { name: '', role: '', batting_style: '', bowling_style: '' },
  });

  return (
    <form
      onSubmit={handleSubmit(data => onSubmit(data, photoFile))}
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
