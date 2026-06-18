import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, {
  message: "Passwords don't match",
  path: ['confirm'],
});

export default function ResetPassword() {
  const navigate = useNavigate();
  const init = useAuthStore(s => s.init);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  useEffect(() => {
    // Supabase exchanges the recovery token from the URL hash automatically
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/login', { replace: true });
      } else {
        setReady(true);
      }
    });
  }, []);

  async function onSubmit({ password }) {
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    await init();
    setTimeout(() => navigate('/', { replace: true }), 2000);
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-brand-green border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#fafafb] dark:bg-ink-900">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-green to-brand-teal mb-3">
            <span className="text-2xl">🏏</span>
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">New password</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">Choose a strong password for your account</p>
        </div>

        {done ? (
          <div className="card p-6 text-center space-y-2">
            <div className="text-3xl">✅</div>
            <p className="font-semibold text-ink-900 dark:text-white">Password updated!</p>
            <p className="text-sm text-ink-500">Redirecting you to the app…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="card p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1">New password</label>
              <input
                {...register('password')}
                type="password"
                autoComplete="new-password"
                className="field-input"
                placeholder="At least 8 characters"
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1">Confirm password</label>
              <input
                {...register('confirm')}
                type="password"
                autoComplete="new-password"
                className="field-input"
                placeholder="Repeat password"
              />
              {errors.confirm && <p className="mt-1 text-xs text-red-500">{errors.confirm.message}</p>}
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
              {isSubmitting ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
