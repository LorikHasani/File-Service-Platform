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
      // AUTH STATE CHANGES
      // ---------------------------------------------------------------
      // CRITICAL: We ONLY clear auth state on explicit SIGNED_OUT.
      // During token refresh, Supabase may fire intermediate events.
      // Clearing profile/user on those events causes cascading failures:
      //   - ProtectedRoute sees user=null → redirects to login
      //   - Hooks see profile=null → bail with loading=false, no data
      //   - Profile never gets restored (TOKEN_REFRESHED doesn't re-fetch it)
      // ---------------------------------------------------------------
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          set({ user: null, session: null, profile: null, isAdmin: false });
          return;
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
      // TAB VISIBILITY — the core fix
      // ---------------------------------------------------------------
      // When tab is backgrounded, browser throttles JS timers so
      // Supabase's autoRefreshToken can't run → JWT expires.
      // On return we must:
      //   1. Get a fresh JWT (refreshSession)
      //   2. Ensure profile is in the store (fetchProfile if missing)
      //   3. THEN signal hooks to re-fetch (bump refreshKey)
      //
      // Steps are sequential (awaited). Hooks only fire AFTER
      // everything is guaranteed valid.
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
            const { data: cached } = await supabase.auth.getSession();
            if (!cached.session?.user) {
              set({ user: null, session: null, profile: null, isAdmin: false });
            }
            return;
          }

          set({ user: data.session.user, session: data.session });

          // Step 2: Ensure profile exists (may have been wiped by a race)
          if (!get().profile) {
            await get().fetchProfile();
          }

          // Step 3: Signal hooks (token valid + profile valid = safe to query)
          set({ refreshKey: get().refreshKey + 1 });
        } catch (err) {
          console.error('Session refresh on tab focus failed:', err);
        } finally {
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
