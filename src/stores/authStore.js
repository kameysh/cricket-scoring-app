import { create } from 'zustand';
import { supabase } from '../lib/supabase';

let _authSubscription = null;
let _userRowChannel = null;

export const useAuthStore = create((set, get) => ({
  session: null,
  user: null,
  role: null,
  loading: true,

  async init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await get()._setSession(session);
    } else {
      set({ loading: false });
    }

    if (_authSubscription) _authSubscription.unsubscribe();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await get()._setSession(session);
      } else {
        get()._teardownUserRowWatch();
        set({ session: null, user: null, role: null, loading: false });
      }
    });
    _authSubscription = subscription;
  },

  _setupUserRowWatch(userId) {
    // Clean up any previous channel first
    get()._teardownUserRowChannel();

    _userRowChannel = supabase
      .channel(`app_users:${userId}`)
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'app_users', filter: `id=eq.${userId}` },
        () => {
          // Admin removed this user — sign out immediately
          supabase.auth.signOut();
        }
      )
      .subscribe();
  },

  _teardownUserRowChannel() {
    if (_userRowChannel) {
      supabase.removeChannel(_userRowChannel);
      _userRowChannel = null;
    }
  },

  // Alias kept for backwards compat call in onAuthStateChange
  _teardownUserRowWatch() {
    get()._teardownUserRowChannel();
  },

  async _setSession(session) {
    set({ session, user: session.user });
    const { data } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!data) {
      // User was deleted from app_users — revoke their session
      get()._teardownUserRowChannel();
      await supabase.auth.signOut();
      set({ session: null, user: null, role: null, loading: false });
      return;
    }

    set({ role: data.role, loading: false });
    get()._setupUserRowWatch(session.user.id);
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    await supabase.auth.signOut();
    set({ session: null, user: null, role: null });
  },
}));
