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

  // Actions
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

  initialize: async () => {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        set({ user: session.user, session });
        await get().fetchProfile();
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        set({ user: session?.user ?? null, session });
        
        if (session?.user) {
          await get().fetchProfile();
        } else {
          set({ profile: null, isAdmin: false });
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

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
        options: {
          data: metadata,
        },
      });

      if (error) throw error;

      // Update profile with additional info if user was created
      if (data.user) {
        await supabase.from('profiles').update({
          contact_name: metadata.contact_name,
          company_name: metadata.company_name || null,
        }).eq('id', data.user.id);
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
      console.log('Fetching profile for user:', user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Profile fetch error:', error);
        throw error;
      }

      console.log('Profile fetched:', data);
      console.log('User role:', data.role);
      
      const isAdmin = data.role === 'admin' || data.role === 'superadmin';
      console.log('Is admin:', isAdmin);
      
      set({ profile: data, isAdmin });
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Don't crash - set default values
      set({ profile: null, isAdmin: false });
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

// Selectors
export const selectUser = (state: AuthState) => state.user;
export const selectProfile = (state: AuthState) => state.profile;
export const selectIsAuthenticated = (state: AuthState) => !!state.user;
export const selectIsAdmin = (state: AuthState) => state.isAdmin;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectCreditBalance = (state: AuthState) => state.profile?.credit_balance ?? 0;
