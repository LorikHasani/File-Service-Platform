import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

// Auto sign-out after this much inactivity (no mouse/keyboard/touch).
// Set to 0 to disable idle logout entirely.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Activity is shared across tabs through this localStorage key, so a
// background tab doesn't sign the user out while they actively work
// in another tab.
const ACTIVITY_KEY = 'portal-last-activity';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  refreshKey: number;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata: { contact_name: string; company_name?: string; phone?: string }) => Promise<{ error: Error | null }>;
  signOut: (options?: { reason?: 'idle' }) => Promise<void>;
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
      // IDLE TIMEOUT — sign out after IDLE_TIMEOUT_MS of inactivity
      // ---------------------------------------------------------------
      // lastActivity is checked BEFORE being reset by an activity
      // event: when the user returns to a tab left open overnight,
      // the returning click/keypress must trigger the sign-out, not
      // count as fresh activity that rescues the session.
      // The interval covers the tab-visible-but-untouched case.
      // ---------------------------------------------------------------
      let lastActivity = Date.now();
      let lastPersisted = 0;
      let idleSignOutStarted = false;

      const signOutIfIdle = (): boolean => {
        if (IDLE_TIMEOUT_MS <= 0 || idleSignOutStarted) return idleSignOutStarted;
        if (!get().user) return false;

        // Consider activity from ALL tabs, not just this one, so a
        // background tab doesn't log out a user who is actively
        // working in another tab.
        let crossTabActivity = 0;
        try {
          crossTabActivity = Number(localStorage.getItem(ACTIVITY_KEY)) || 0;
        } catch {
          // localStorage unavailable — fall back to this tab only.
        }

        if (Date.now() - Math.max(lastActivity, crossTabActivity) < IDLE_TIMEOUT_MS) return false;
        idleSignOutStarted = true;
        get().signOut({ reason: 'idle' });
        return true;
      };

      const onActivity = () => {
        if (signOutIfIdle()) return;
        lastActivity = Date.now();

        // Persist for other tabs, throttled — mousemove fires far too
        // often for a synchronous localStorage write on every event.
        if (lastActivity - lastPersisted > 10 * 1000) {
          lastPersisted = lastActivity;
          try {
            localStorage.setItem(ACTIVITY_KEY, String(lastActivity));
          } catch {
            // localStorage unavailable — other tabs just won't see us.
          }
        }
      };

      (['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const).forEach((evt) => {
        window.addEventListener(evt, onActivity, { passive: true });
      });

      window.setInterval(signOutIfIdle, 60 * 1000);

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

        // A tab restored after long suspension must log out, not
        // refresh its way back into a live session.
        if (signOutIfIdle()) return;

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
          .update({
            contact_name: metadata.contact_name,
            company_name: metadata.company_name || null,
            phone: metadata.phone || null,
          })
          .eq('id', data.user.id);
      }
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  signOut: async (options) => {
    // Clear Zustand state first.
    set({ user: null, profile: null, session: null, isAdmin: false });

    // scope: 'local' revokes THIS session's refresh token server-side
    // (auth-js calls /logout?scope=local — it is not storage-only), so
    // a token copied from this device is dead after logout, while the
    // user's other devices stay signed in. After bfcache restoration
    // the client may have stale internal state that makes this call
    // hang, so it races a timeout instead of being awaited blindly.
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);

    // If the global call hung or failed before clearing storage, the
    // session would survive the reload below and the user would still
    // be logged in. Remove Supabase's auth keys directly — this needs
    // no network and cannot hang.
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('sb-') && key.includes('-auth-token'))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // localStorage unavailable — nothing more we can do.
    }

    // Hard redirect bypasses ProtectedRoute's grace period.
    window.location.replace(options?.reason === 'idle' ? '/login?reason=idle' : '/login');
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

      // ---------------------------------------------------------------
      // SYNC AUTH METADATA → PROFILE
      // ---------------------------------------------------------------
      // When a user registers, Supabase stores the metadata in
      // raw_user_meta_data. If email confirmation is required the
      // client may not have a session yet when signUp tries to
      // update the profile row, so phone/company can be lost.
      // On first login we detect missing fields and sync them.
      // ---------------------------------------------------------------
      const meta = user.user_metadata;
      if (meta && data) {
        const updates: Record<string, string> = {};
        if (!data.contact_name && meta.contact_name) updates.contact_name = meta.contact_name;
        if (!data.company_name && meta.company_name) updates.company_name = meta.company_name;
        if (!data.phone && meta.phone) updates.phone = meta.phone;

        if (Object.keys(updates).length > 0) {
          const { data: updated } = await supabase
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', user.id)
            .select('*')
            .single();

          if (updated) {
            set({ profile: updated, isAdmin: updated.role === 'admin' || updated.role === 'superadmin' });
            return;
          }
        }
      }

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
