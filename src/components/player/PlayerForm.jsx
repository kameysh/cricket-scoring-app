import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, User, ShieldCheck, Link2 } from 'lucide-react';
import PlayerAvatar from './PlayerAvatar';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  role: z.string().optional(),
  batting_style: z.string().optional(),
  bowling_style: z.string().optional(),
});

const MAX_BYTES = 8 * 1024 * 1024;

const ROLES = [
  { value: 'batsman',       label: 'Batsman',       emoji: '🏏' },
  { value: 'bowler',        label: 'Bowler',         emoji: '🎳' },
  { value: 'allrounder',    label: 'All-rounder',    emoji: '⚡' },
  { value: 'wicket_keeper', label: 'Keeper',         emoji: '🧤' },
];

const BATTING = [
  { value: 'right-hand', label: 'Right-hand' },
  { value: 'left-hand',  label: 'Left-hand'  },
];

const BOWLING = [
  { value: 'right-arm-fast',   label: 'Right-arm Fast',   group: 'Right Arm' },
  { value: 'right-arm-medium', label: 'Right-arm Medium', group: 'Right Arm' },
  { value: 'right-arm-spin',   label: 'Right-arm Spin',   group: 'Right Arm' },
  { value: 'left-arm-fast',    label: 'Left-arm Fast',    group: 'Left Arm'  },
  { value: 'left-arm-medium',  label: 'Left-arm Medium',  group: 'Left Arm'  },
  { value: 'left-arm-spin',    label: 'Left-arm Spin',    group: 'Left Arm'  },
  { value: 'none',             label: "Doesn't bowl",     group: ''          },
];

function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(active ? '' : opt.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
              active
                ? 'bg-brand-green text-white border-brand-green shadow-sm'
                : 'bg-white dark:bg-white/5 text-ink-600 dark:text-ink-300 border-ink-200 dark:border-white/10 hover:border-brand-green/50'
            }`}
          >
            {opt.emoji && <span className="text-base leading-none">{opt.emoji}</span>}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={13} className="text-brand-green" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-ink-400">{label}</span>
    </div>
  );
}

export default function PlayerForm({ initial, onSubmit, submitLabel = 'Save Player', appUsers = [], isAdmin = false }) {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(initial?.photo_url || null);
  const [linkedUserId, setLinkedUserId] = useState('');
  const [isGuest, setIsGuest] = useState(initial?.is_guest ?? false);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initial || { name: '', role: '', batting_style: '', bowling_style: '' },
  });

  const role = watch('role');
  const battingStyle = watch('batting_style');
  const bowlingStyle = watch('bowling_style');
  const nameVal = watch('name');

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) { toast.error('Photo must be 8MB or smaller'); return; }
    setPhotoPreview(URL.createObjectURL(file));
    setPhotoFile(file);
  }

  return (
    <form
      onSubmit={handleSubmit(data => onSubmit({
        ...data,
        is_guest: isGuest,
        user_id: linkedUserId || undefined,
        ...(linkedUserId ? { is_guest: false } : {}),
      }, photoFile))}
      className="space-y-4 pb-6"
    >
      {/* ── Hero photo section ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-brand-green/20 to-brand-teal/10 dark:from-brand-green/10 dark:to-brand-teal/5 border border-brand-green/10">
        <div className="flex items-center gap-5 p-5">
          {/* Avatar with tap-to-change overlay */}
          <label className="relative group cursor-pointer shrink-0">
            {photoPreview
              ? <img src={photoPreview} alt={nameVal} className="w-20 h-20 rounded-full object-cover ring-4 ring-white dark:ring-ink-800 shadow-lg" />
              : <PlayerAvatar name={nameVal || 'P'} size={80} className="ring-4 ring-white dark:ring-ink-800 shadow-lg" />
            }
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={18} className="text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-brand-green border-2 border-white dark:border-ink-800 flex items-center justify-center shadow-sm">
              <Camera size={11} className="text-white" />
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>

          {/* Name input */}
          <div className="flex-1 min-w-0">
            <label className="block text-xs font-semibold text-ink-400 mb-1">Player Name <span className="text-red-400">*</span></label>
            <input
              {...register('name')}
              placeholder="Full name"
              className="w-full bg-transparent text-xl font-bold text-ink-900 dark:text-white placeholder-ink-300 dark:placeholder-ink-600 border-b-2 border-ink-200 dark:border-white/20 focus:border-brand-green focus:outline-none pb-1 transition-colors"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>
        </div>
      </div>

      {/* ── Playing Role ── */}
      <div className="card p-4">
        <SectionLabel icon={User} label="Playing Role" />
        <PillGroup
          options={ROLES}
          value={role}
          onChange={v => setValue('role', v)}
        />
      </div>

      {/* ── Batting & Bowling ── */}
      <div className="card p-4 space-y-4">
        <SectionLabel icon={ShieldCheck} label="Playing Style" />

        <div>
          <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2">Batting hand</p>
          <PillGroup
            options={BATTING}
            value={battingStyle}
            onChange={v => setValue('batting_style', v)}
          />
        </div>

        <div>
          <p className="text-xs font-semibold text-ink-500 dark:text-ink-400 mb-2">Bowling style</p>
          <PillGroup
            options={BOWLING}
            value={bowlingStyle}
            onChange={v => setValue('bowling_style', v)}
          />
        </div>
      </div>

      {/* ── Admin: Guest toggle + Link account ── */}
      {isAdmin && (
        <div className="card p-4 space-y-3">
          <SectionLabel icon={Link2} label="Account" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">Guest player</p>
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

          {!isGuest && appUsers.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-ink-500 dark:text-ink-400 mb-1.5">
                Link to user account <span className="text-ink-300 font-normal">(optional)</span>
              </label>
              <select
                value={linkedUserId}
                onChange={e => setLinkedUserId(e.target.value)}
                className="field-input !text-sm"
              >
                <option value="">— Not linked —</option>
                {appUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email} ({u.email})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-400">Player can manage their own profile once linked.</p>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary w-full !py-3.5 text-base"
      >
        {isSubmitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
