import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, Users2, Swords, Trophy, BarChart2, LogIn, LogOut, Shield, MapPin, ChevronRight, Repeat2, Sun, Moon, Monitor, Gavel } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore, applyTheme } from '../../stores/themeStore';
import { isPushSupported, subscribeToPush, unsubscribeFromPush, getPushStatus } from '../../services/pushService';

const ROLE_LABELS = {
  admin: 'Admin',
  scorer: 'Scorer',
  captain: 'Captain',
  viewer: 'Viewer',
};

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/matches', label: 'Matches', icon: Swords },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/leaderboard', label: 'Rankings', icon: BarChart2 },
  { to: '/tournaments', label: 'Tourneys', icon: Trophy },
];

const THEME_OPTIONS = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [showSheet, setShowSheet] = useState(false);
  const [pushStatus, setPushStatus] = useState('unsupported'); // 'unsupported'|'not_subscribed'|'subscribed'|'denied'
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    if (!showSheet) return;
    getPushStatus().then(setPushStatus).catch(() => {});
  }, [showSheet]);

  async function handlePushToggle() {
    setPushLoading(true);
    try {
      if (pushStatus === 'subscribed') {
        await unsubscribeFromPush();
        setPushStatus('not_subscribed');
      } else {
        const result = await subscribeToPush();
        setPushStatus(result === 'granted' ? 'subscribed' : result);
      }
    } catch {
      // silently ignore
    } finally {
      setPushLoading(false);
    }
  }

  function handleTheme(t) {
    setTheme(t);
    applyTheme(t);
  }

  async function handleSignOut() {
    setShowSheet(false);
    await signOut();
    navigate('/login');
  }

  return (
    <>
      {/* User sheet overlay */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowSheet(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-2xl bg-white dark:bg-ink-800 rounded-t-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-green to-brand-teal flex items-center justify-center text-white font-bold text-lg">
                {user?.email?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900 dark:text-white">{user?.email}</p>
                <span className="text-xs font-medium text-brand-green">{ROLE_LABELS[role] || role}</span>
              </div>
            </div>

            {role === 'admin' && (
              <>
                <button
                  onClick={() => { setShowSheet(false); navigate('/venues'); }}
                  className="w-full flex items-center justify-between py-3 px-1 border-t border-ink-100 dark:border-white/10 text-sm font-medium text-ink-700 dark:text-ink-200"
                >
                  <span className="flex items-center gap-2"><MapPin size={16} /> Venues</span>
                  <ChevronRight size={16} className="text-ink-400" />
                </button>
                <button
                  onClick={() => { setShowSheet(false); navigate('/teams'); }}
                  className="w-full flex items-center justify-between py-3 px-1 border-t border-ink-100 dark:border-white/10 text-sm font-medium text-ink-700 dark:text-ink-200"
                >
                  <span className="flex items-center gap-2"><Users2 size={16} /> Teams</span>
                  <ChevronRight size={16} className="text-ink-400" />
                </button>
                <button
                  onClick={() => { setShowSheet(false); navigate('/series'); }}
                  className="w-full flex items-center justify-between py-3 px-1 border-t border-ink-100 dark:border-white/10 text-sm font-medium text-ink-700 dark:text-ink-200"
                >
                  <span className="flex items-center gap-2"><Repeat2 size={16} /> Tournament Series</span>
                  <ChevronRight size={16} className="text-ink-400" />
                </button>
                <button
                  onClick={() => { setShowSheet(false); navigate('/admin/users'); }}
                  className="w-full flex items-center justify-between py-3 px-1 border-t border-ink-100 dark:border-white/10 text-sm font-medium text-ink-700 dark:text-ink-200"
                >
                  <span className="flex items-center gap-2"><Shield size={16} /> Manage Users</span>
                  <ChevronRight size={16} className="text-ink-400" />
                </button>
              </>
            )}

            {/* Auctions — visible to all logged-in users */}
            <button
              onClick={() => { setShowSheet(false); navigate('/auctions'); }}
              className="w-full flex items-center justify-between py-3 px-1 border-t border-ink-100 dark:border-white/10 text-sm font-medium text-ink-700 dark:text-ink-200"
            >
              <span className="flex items-center gap-2"><Gavel size={16} /> Auctions</span>
              <ChevronRight size={16} className="text-ink-400" />
            </button>

            {/* Theme toggle — visible to all logged-in users */}
            <div className="w-full flex items-center justify-between py-3 px-1 border-t border-ink-100 dark:border-white/10">
              <span className="text-sm font-medium text-ink-700 dark:text-ink-200">Appearance</span>
              <div className="flex gap-1 bg-ink-100 dark:bg-white/10 rounded-lg p-0.5">
                {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    aria-label={label}
                    onClick={() => handleTheme(value)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      theme === value
                        ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-white shadow-sm'
                        : 'text-ink-400 dark:text-ink-400'
                    }`}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Push notifications toggle */}
            {pushStatus !== 'unsupported' && (
              <div className="w-full flex items-center justify-between py-3 px-1 border-t border-ink-100 dark:border-white/10">
                <div>
                  <span className="text-sm font-medium text-ink-700 dark:text-ink-200">Notifications</span>
                  {pushStatus === 'denied' && <p className="text-[11px] text-red-400 mt-0.5">Blocked in browser settings</p>}
                </div>
                {pushStatus !== 'denied' && (
                  <button
                    onClick={handlePushToggle}
                    disabled={pushLoading}
                    aria-label={pushStatus === 'subscribed' ? 'Disable notifications' : 'Enable notifications'}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${pushStatus === 'subscribed' ? 'bg-brand-green' : 'bg-ink-200 dark:bg-white/20'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${pushStatus === 'subscribed' ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 py-3 px-1 border-t border-ink-100 dark:border-white/10 text-sm font-medium text-red-500"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/85 dark:bg-ink-900/85 backdrop-blur-xl border-t border-ink-100 dark:border-white/5 flex justify-between px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+6px)]">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `relative flex-1 flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-ink-900 dark:text-white' : 'text-ink-400 hover:text-ink-600 dark:hover:text-ink-200'
              }`
            }
            aria-label={label}
          >
            {({ isActive }) => (
              <>
                <span
                  className={`flex items-center justify-center w-10 h-7 rounded-full transition-all ${
                    isActive ? 'bg-gradient-to-r from-brand-green via-brand-teal to-brand-blue' : ''
                  }`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-white' : ''} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}

        {/* User / Login tab */}
        {user ? (
          <button
            onClick={() => setShowSheet(true)}
            className="relative flex-1 flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium text-ink-400 hover:text-ink-600 dark:hover:text-ink-200"
            aria-label="Account"
          >
            <span className="flex items-center justify-center w-10 h-7 rounded-full">
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-green to-brand-teal flex items-center justify-center text-white text-[10px] font-bold">
                {user.email?.[0]?.toUpperCase()}
              </span>
            </span>
            {ROLE_LABELS[role] || 'Me'}
          </button>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              `relative flex-1 flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition-colors ${
                isActive ? 'text-ink-900 dark:text-white' : 'text-ink-400 hover:text-ink-600 dark:hover:text-ink-200'
              }`
            }
            aria-label="Login"
          >
            {({ isActive }) => (
              <>
                <span className={`flex items-center justify-center w-10 h-7 rounded-full transition-all ${isActive ? 'bg-gradient-to-r from-brand-green via-brand-teal to-brand-blue' : ''}`}>
                  <LogIn size={18} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-white' : ''} />
                </span>
                Login
              </>
            )}
          </NavLink>
        )}
      </nav>
    </>
  );
}
