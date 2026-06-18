import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuthStore();
  const [authError, setAuthError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [forgotSent, setForgotSent] = useState(false);

  const from = location.state?.from?.pathname || '/';

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const forgotForm = useForm({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  async function onLogin({ email, password }) {
    setAuthError('');
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setAuthError(err.message || 'Sign in failed. Check your credentials.');
    }
  }

  async function onForgot({ email }) {
    setAuthError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    setForgotSent(true);
  }

  function switchToForgot() {
    setAuthError('');
    setForgotSent(false);
    setMode('forgot');
  }

  function switchToLogin() {
    setAuthError('');
    setForgotSent(false);
    setMode('login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#fafafb] dark:bg-ink-900">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-green to-brand-teal mb-3">
            <span className="text-2xl">🏏</span>
          </div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Cricket Scorer</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            {mode === 'login' ? 'Sign in to your account' : 'Reset your password'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onLogin)} className="card p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1">Email</label>
              <input
                {...loginForm.register('email')}
                type="email"
                autoComplete="email"
                className="field-input"
                placeholder="you@example.com"
              />
              {loginForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-500">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-ink-700 dark:text-ink-300">Password</label>
                <button
                  type="button"
                  onClick={switchToForgot}
                  className="text-xs text-brand-green hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                {...loginForm.register('password')}
                type="password"
                autoComplete="current-password"
                className="field-input"
                placeholder="••••••••"
              />
              {loginForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-500">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            {authError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{authError}</p>
            )}

            <button type="submit" disabled={loginForm.formState.isSubmitting} className="btn-primary w-full">
              {loginForm.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <div className="card p-5 space-y-4">
            {forgotSent ? (
              <div className="text-center space-y-3 py-2">
                <div className="text-4xl">📬</div>
                <p className="font-semibold text-ink-900 dark:text-white">Check your inbox</p>
                <p className="text-sm text-ink-500 dark:text-ink-400 leading-relaxed">
                  We've sent a password reset link to your email. Click the link in the email to set a new password.
                </p>
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="text-sm text-brand-green hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                <p className="text-sm text-ink-500 dark:text-ink-400 leading-relaxed">
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <div>
                  <label className="block text-sm font-medium text-ink-700 dark:text-ink-300 mb-1">Email</label>
                  <input
                    {...forgotForm.register('email')}
                    type="email"
                    autoComplete="email"
                    className="field-input"
                    placeholder="you@example.com"
                  />
                  {forgotForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-red-500">{forgotForm.formState.errors.email.message}</p>
                  )}
                </div>

                {authError && (
                  <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{authError}</p>
                )}

                <button type="submit" disabled={forgotForm.formState.isSubmitting} className="btn-primary w-full">
                  {forgotForm.formState.isSubmitting ? 'Sending…' : 'Send reset link'}
                </button>

                <button
                  type="button"
                  onClick={switchToLogin}
                  className="w-full text-sm text-ink-500 hover:text-ink-700 dark:hover:text-ink-300 text-center"
                >
                  ← Back to sign in
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-xs text-ink-400">
          Don't have an account? Ask your admin to invite you.
        </p>
      </div>
    </div>
  );
}
