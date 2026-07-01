import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from '@/components/Layout';
import { Button, Input, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

// The reset email link redirects here with a recovery token in the URL hash.
// The Supabase client (detectSessionInUrl: true) exchanges it for a session
// automatically — we just wait for that session to appear before showing the
// new-password form.
export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'invalid'>('checking');

  useEffect(() => {
    let done = false;

    // The token exchange from the URL hash is asynchronous, so listen for the
    // session as well as checking for one that already exists.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !done) {
        done = true;
        setSessionState('ready');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !done) {
        done = true;
        setSessionState('ready');
      }
    });

    // If no session shows up shortly, the link is invalid or expired.
    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        setSessionState('invalid');
      }
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Password updated — you are signed in');
      // The recovery link signed the user in; make sure the store has their
      // profile before landing them in the app.
      await useAuthStore.getState().fetchProfile();
      navigate(useAuthStore.getState().isAdmin ? '/admin' : '/dashboard', { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  if (sessionState === 'checking') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size="lg" />
          <p className="text-zinc-500 mt-4 text-sm">Verifying reset link…</p>
        </div>
      </AuthLayout>
    );
  }

  if (sessionState === 'invalid') {
    return (
      <AuthLayout>
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Link invalid or expired</h1>
          <p className="text-zinc-500 mb-8">
            Password reset links only work once and expire after a short time.
            Request a new one and try again.
          </p>
          <Link to="/forgot-password" className="text-red-600 font-medium hover:underline">
            Request a new reset link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
          <KeyRound className="w-6 h-6 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Set a new password</h1>
        <p className="text-zinc-500 mt-1">Choose a new password for your account.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="relative">
          <Input
            label="New password"
            type={showPassword ? 'text' : 'password'}
            placeholder="At least 8 characters"
            leftIcon={<Lock size={18} />}
            error={errors.password?.message}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[34px] text-zinc-400 hover:text-zinc-600"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <Input
          label="Confirm new password"
          type="password"
          placeholder="Re-enter new password"
          leftIcon={<Lock size={18} />}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
};
