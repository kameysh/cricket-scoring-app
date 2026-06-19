import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ChevronLeft, Shield, Trash2, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { masterReset } from '../services/playerService';
import { useAuthStore } from '../stores/authStore';
import { useRole } from '../hooks/useRole';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  admin: 'Admin',
  scorer: 'Scorer',
  captain: 'Captain',
  viewer: 'Viewer',
  player: 'Player',
};

function friendlyInviteError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already exists')) return 'This email is already registered.';
  if (m.includes('invalid email')) return 'Please enter a valid email address.';
  if (m.includes('forbidden') || m.includes('admin only')) return 'Only admins can invite users.';
  if (m.includes('unauthorized')) return 'Your session has expired. Please sign in again.';
  if (m.includes('rate limit') || m.includes('over_email_send_rate_limit')) return 'Too many invites sent. Please wait a moment and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'Network error. Check your connection and try again.';
  if (m.includes('smtp') || m.includes('auth invite failed')) return 'Email delivery failed. Check your SMTP settings in Supabase.';
  // Catch-all for any remaining unrecognised errors (including raw {} from Supabase)
  return 'Could not send invite. Please check your SMTP settings or try again later.';
}

function friendlyDeleteError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('forbidden') || m.includes('admin only')) return 'Only admins can delete users.';
  if (m.includes('unauthorized')) return 'Your session has expired. Please sign in again.';
  if (m.includes('cannot delete your own')) return 'You cannot delete your own account.';
  if (m.includes('network') || m.includes('fetch')) return 'Network error. Check your connection and try again.';
  return 'Failed to remove user. Please try again.';
}

const ROLE_COLORS = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  scorer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  captain: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  player: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  if (!isAdmin) { navigate('/'); return null; }
  const currentUser = useAuthStore(s => s.user);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmResetStats, setConfirmResetStats] = useState(false);
  const [resettingStats, setResettingStats] = useState(false);
  const isSuperAdmin = currentUser?.email === 'kameshwaran26@gmail.com';

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const { data, error } = await supabase.from('app_users').select('*').order('created_at');
    if (!error) setUsers(data || []);
    setLoading(false);
  }

  async function handleResetStats() {
    setResettingStats(true);
    try {
      await masterReset();
      toast.success('All match data and stats have been reset');
    } catch (e) {
      toast.error(e?.message || 'Failed to reset stats');
    } finally {
      setResettingStats(false);
      setConfirmResetStats(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail, full_name: inviteName, role: inviteRole },
      });

      console.log('[invite-user] data:', data, 'error:', error);
      // When edge function returns non-2xx, real error is in error.context (raw Response)
      if (error) {
        let errMsg = error.message;
        try {
          const body = await error.context?.json?.();
          if (body?.error) errMsg = body.error;
          else if (body?.code) errMsg = body.code;
        } catch {}
        throw new Error(errMsg || 'Edge function error');
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.success) throw new Error('Invite did not complete — check Supabase logs');

      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInvite(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('viewer');
      fetchUsers();
    } catch (err) {
      toast.error(friendlyInviteError(err.message));
    } finally {
      setInviting(false);
    }
  }

  async function handleDelete(userId) {
    setDeletingId(userId);
    try {
      // Try edge function first (full auth deletion)
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error || data?.error) {
        // Edge function not deployed yet — fall back to removing from app_users only
        const { error: dbError } = await supabase.from('app_users').delete().eq('id', userId);
        if (dbError) throw dbError;
      }

      toast.success('User removed');
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      toast.error(friendlyDeleteError(err.message));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  async function handleRoleChange(userId, newRole) {
    const { error } = await supabase.from('app_users').update({ role: newRole }).eq('id', userId);
    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success('Role updated');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    }
  }

  return (
    <div className="p-4 space-y-4 page-transition">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-white/10">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Shield size={18} className="text-brand-green" />
          <h1 className="text-xl font-bold text-ink-900 dark:text-white">Manage Users</h1>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-chip">
          <UserPlus size={15} /> Invite
        </button>
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} className="card p-4 space-y-3 border border-brand-green/30">
          <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Invite new user</h2>
          <div>
            <label className="block text-xs font-medium text-ink-600 dark:text-ink-400 mb-1">Full name</label>
            <input value={inviteName} onChange={e => setInviteName(e.target.value)} className="field-input" placeholder="Name" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 dark:text-ink-400 mb-1">Email</label>
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" className="field-input" placeholder="user@example.com" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 dark:text-ink-400 mb-1">Role</label>
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="field-input">
              <option value="player">Player</option>
              <option value="viewer">Viewer</option>
              <option value="scorer">Scorer</option>
              <option value="captain">Captain</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={inviting} className="btn-primary flex-1 text-sm py-2">
              {inviting ? 'Sending…' : 'Send Invite'}
            </button>
            <button type="button" onClick={() => setShowInvite(false)} className="flex-1 py-2 rounded-lg border border-ink-200 dark:border-white/10 text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-ink-100 dark:bg-white/5 animate-pulse" />)}
        </div>
      ) : users.length === 0 ? (
        <p className="text-center text-ink-400 py-8 text-sm">No users yet. Invite someone to get started.</p>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="card p-3 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-green to-brand-teal flex items-center justify-center text-white text-sm font-bold shrink-0 mt-0.5">
                {(u.full_name || u.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 dark:text-white truncate leading-tight">{u.full_name || '—'}</p>
                <p className="text-xs text-ink-400 truncate mt-0.5">{u.email}</p>
                <select
                  value={u.role}
                  onChange={e => handleRoleChange(u.id, e.target.value)}
                  className={`mt-2 text-xs font-semibold px-3 py-1 rounded-full border-0 cursor-pointer ${ROLE_COLORS[u.role]}`}
                >
                  {Object.entries(ROLE_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="shrink-0">
                {u.id !== currentUser?.id ? (
                  <button
                    onClick={() => setConfirmDeleteId(u.id)}
                    className="p-1.5 rounded-lg text-ink-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <div className="w-8" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        danger
        title="Remove user?"
        message={`${users.find(u => u.id === confirmDeleteId)?.full_name || 'This user'} will lose access to the app immediately.`}
        confirmLabel={deletingId ? 'Removing…' : 'Remove'}
        disabled={!!deletingId}
        onConfirm={() => handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {isSuperAdmin && (
        <div className="mt-6 border-t border-red-200 dark:border-red-900/40 pt-5">
          <p className="text-xs text-ink-400 uppercase tracking-widest mb-3 font-semibold">Danger Zone</p>
          <button
            onClick={() => setConfirmResetStats(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-semibold border border-red-200 dark:border-red-800 active:scale-95 transition-transform"
          >
            <RotateCcw size={15} />
            Reset All Player Stats
          </button>
          <p className="text-xs text-ink-400 mt-2">Deletes all matches, innings, deliveries and stats. Players &amp; users are kept.</p>
        </div>
      )}

      <ConfirmDialog
        open={confirmResetStats}
        danger
        title="Master reset?"
        message="This will delete ALL matches, innings, deliveries, scorecards, and player stats. Players and users are kept. This cannot be undone."
        confirmLabel={resettingStats ? 'Resetting…' : 'Reset Everything'}
        disabled={resettingStats}
        onConfirm={handleResetStats}
        onCancel={() => setConfirmResetStats(false)}
      />
    </div>
  );
}
