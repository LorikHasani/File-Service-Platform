import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  refreshKey: number;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata: { contact_name: string; company_name?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  isAdmin: false,
  refreshKey: 0,

  initialize: async () => {
    try {
      // ---------------------------------------------------------------
      // SESSION RECOVERY
      // ---------------------------------------------------------------
      // refreshSession() gets a fresh JWT. getSession() only returns
      // what's in memory/localStorage without validating.
      // If we don't refresh first and the JWT expired while the user
      // was away, fetchProfile() fails silently (RLS rejects expired
      // JWT), profile stays null, all hooks bail, page shows no data.
      // ---------------------------------------------------------------
      const { data: { session: stored } } = await supabase.auth.getSession();

      if (stored?.user) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        const activeSession = refreshData?.session || stored;

        set({ user: activeSession.user, session: activeSession });
        await get().fetchProfile();
      }

      // ---------------------------------------------------------------
      // AUTH STATE CHANGES
      // ---------------------------------------------------------------
      // SIGNED_OUT events are IGNORED. They are almost always transient
      // noise from Supabase's Realtime WebSocket reconnecting after the
      // tab is backgrounded. When Supabase fires SIGNED_OUT it also
      // clears its internal session, so any getSession() check after
      // that returns null — making it impossible to distinguish real
      // from transient sign-outs. The old debounced handler would
      // clear our Zustand state, and then the visibilitychange handler
      // (refreshAuth) would bail because user/session were null →
      // no recovery → stuck loading spinner forever.
      //
      // Real sign-outs are handled by signOut() which clears state
      // directly and hard-redirects to /login.
      //
      // For any event that brings a valid session (SIGNED_IN,
      // TOKEN_REFRESHED, etc.), we update state and ensure the
      // profile is loaded.
      // ---------------------------------------------------------------
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') return;

        if (session?.user) {
          set({ user: session.user, session });
          if (!get().profile) {
            await get().fetchProfile();
          }
        }
      });

      // ---------------------------------------------------------------
      // TAB VISIBILITY — refresh session + re-fetch data on focus
      // ---------------------------------------------------------------
      // Uses a timestamp debounce (not a boolean flag). A boolean
      // flag can get stuck as `true` if the page is suspended mid-
      // refresh, permanently blocking all future refreshes.
      // ---------------------------------------------------------------
      let lastRefresh = 0;

      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') return;

        // Debounce: max once per 3 seconds
        const now = Date.now();
        if (now - lastRefresh < 3000) return;
        lastRefresh = now;

        try {
          const { data, error } = await supabase.auth.refreshSession();

          if (data?.session?.user) {
            set({ user: data.session.user, session: data.session });
            if (!get().profile) {
              await get().fetchProfile();
            }
            set({ refreshKey: get().refreshKey + 1 });
          } else if (error) {
            // Refresh failed — genuinely logged out
            const currentUser = get().user;
            if (currentUser) {
              set({ user: null, session: null, profile: null, isAdmin: false });
            }
          }
        } catch (err) {
          console.error('Session refresh failed:', err);
        }
      });

      // ---------------------------------------------------------------
      // BFCACHE (Back-Forward Cache)
      // ---------------------------------------------------------------
      // When the user navigates to another site and comes back via
      // browser back button, the page may be restored from bfcache
      // with frozen JS. Force a full reload for a clean state.
      // ---------------------------------------------------------------
      window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
          window.location.reload();
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      set({ user: data.user, session: data.session });
      await get().fetchProfile();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  signUp: async (email, password, metadata) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });
      if (error) throw error;

      if (data.user) {
        await new Promise((r) => setTimeout(r, 500));
        await supabase
          .from('profiles')
          .update({ contact_name: metadata.contact_name, company_name: metadata.company_name || null })
          .eq('id', data.user.id);
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  signOut: async () => {
    // Clear state first, then sign out from Supabase.
    // Use window.location.replace for a hard redirect that bypasses
    // ProtectedRoute's grace period (which would otherwise keep
    // showing the page for 5 s waiting for auth to recover).
    //
    // IMPORTANT: Do NOT await signOut() before redirecting.
    // After bfcache restoration the Supabase client may have stale
    // internal state that causes the network call to hang, blocking
    // the redirect indefinitely. Fire-and-forget is safe because
    // we already cleared local state above.
    set({ user: null, profile: null, session: null, isAdmin: false });
    supabase.auth.signOut().catch(() => {});
    window.location.replace('/login');
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      set({ profile: data, isAdmin: data.role === 'admin' || data.role === 'superadmin' });
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;
      await get().fetchProfile();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
}));

export const selectUser = (state: AuthState) => state.user;
export const selectProfile = (state: AuthState) => state.profile;
export const selectIsAuthenticated = (state: AuthState) => !!state.user;
export const selectIsAdmin = (state: AuthState) => state.isAdmin;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectCreditBalance = (state: AuthState) => state.profile?.credit_balance ?? 0;
