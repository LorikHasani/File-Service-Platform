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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        set({ user: session.user, session });
        await get().fetchProfile();
      }

      // ---------------------------------------------------------------
      // AUTH STATE CHANGES — debounced SIGNED_OUT
      // ---------------------------------------------------------------
      // PROBLEM: When the tab is backgrounded, the browser kills
      // Supabase's Realtime WebSocket. On tab return the WebSocket
      // reconnects, detects the stale JWT, and fires a transient
      // SIGNED_OUT *before* SIGNED_IN arrives with the new token.
      // This happens BEFORE our visibilitychange handler runs, so
      // flag-based suppression can't work (flag isn't set yet).
      //
      // If we clear state on that transient SIGNED_OUT:
      //   - ProtectedRoute sees user=null → redirects to /login
      //   - Page UNMOUNTS (all React state + refs destroyed)
      //   - SIGNED_IN fires → redirect back → page remounts fresh
      //   - profile not loaded yet → hooks bail → loading forever
      //
      // FIX: Debounce SIGNED_OUT — wait 2 s for a SIGNED_IN to
      // follow. If one arrives, cancel the clear (transient). If
      // not, verify with getSession() and clear if truly gone.
      // Genuine user sign-outs bypass this entirely because
      // signOut() clears state directly before the event fires.
      // ---------------------------------------------------------------
      let signOutTimer: ReturnType<typeof setTimeout> | null = null;

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          signOutTimer = setTimeout(async () => {
            signOutTimer = null;
            // Double-check: is the session truly gone?
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
              set({ user: null, session: null, profile: null, isAdmin: false });
            }
          }, 2000);
          return;
        }

        // A valid session arrived — cancel any pending sign-out clear
        if (signOutTimer && session?.user) {
          clearTimeout(signOutTimer);
          signOutTimer = null;
        }

        if (session?.user) {
          const prevUserId = get().user?.id;
          set({ user: session.user, session });

          // Only fetch profile when user actually changes
          if (prevUserId !== session.user.id || event === 'SIGNED_IN') {
            await get().fetchProfile();
          }
        }
        // If session is null but event is NOT SIGNED_OUT: do nothing.
        // This protects against transient null-session events during refresh.
      });

      // ---------------------------------------------------------------
      // TAB VISIBILITY
      // ---------------------------------------------------------------
      // When tab is backgrounded, browser throttles JS timers so
      // Supabase's autoRefreshToken can't run → JWT expires.
      // On return we must:
      //   1. Get a fresh JWT (refreshSession)
      //   2. Ensure profile is in the store (fetchProfile if missing)
      //   3. ALWAYS signal hooks to re-fetch (bump refreshKey)
      //
      // refreshKey is bumped in ALL code paths so hooks always
      // re-fetch. Hooks use a hasLoaded ref to keep showing old
      // data during re-fetch, preventing the "blank page" flash.
      // ---------------------------------------------------------------
      let refreshing = false;
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') return;
        if (refreshing) return;
        if (!get().user && !get().session) return; // not logged in
        refreshing = true;

        try {
          // Step 1: Fresh JWT
          const { data, error } = await supabase.auth.refreshSession();

          if (error || !data.session?.user) {
            // Refresh failed — check if cached session still works
            const { data: cached } = await supabase.auth.getSession();
            if (!cached.session?.user) {
              // Genuinely logged out
              set({ user: null, session: null, profile: null, isAdmin: false });
              return;
            }
          } else {
            set({ user: data.session.user, session: data.session });
          }

          // Step 2: Ensure profile exists (may have been wiped by a race)
          if (!get().profile) {
            await get().fetchProfile();
          }
        } catch (err) {
          console.error('Session refresh on tab focus failed:', err);
        } finally {
          // Step 3: ALWAYS signal hooks to re-fetch, even on error.
          if (get().user) {
            set({ refreshKey: get().refreshKey + 1 });
          }
          refreshing = false;
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
    await supabase.auth.signOut();
    set({ user: null, profile: null, session: null, isAdmin: false });
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
