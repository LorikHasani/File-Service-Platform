import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from '@/components/Layout';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const signIn = useAuthStore((s) => s.signIn);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('reason') === 'idle') {
      toast('You were signed out due to inactivity. Please sign in again.', {
        id: 'idle-signout',
        icon: '⏳',
        duration: 6000,
      });
      searchParams.delete('reason');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);

      if (error) {
        if (/email not confirmed/i.test(error.message)) {
          const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: data.email });
          toast.error(
            resendError
              ? 'Your email is not confirmed yet. Open the confirmation link we emailed you (check your spam folder).'
              : 'Your email is not confirmed yet. We just sent you a new confirmation link — check your inbox and spam folder.',
            { duration: 12000 }
          );
          return;
        }
        toast.error(error.message);
        return;
      }

      toast.success('Welcome back!');
      
      // signIn already calls fetchProfile and awaits it,
      // so the store is up-to-date when we read isAdmin
      const state = useAuthStore.getState();
      navigate(state.isAdmin ? '/admin' : '/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-8">
        <Link to="/" className="mb-8 flex justify-center rounded-xl bg-black px-5 py-5 lg:hidden">
          <img src="/logo-wide.png" alt="ChipTuneFiles" className="w-full max-w-[320px] h-auto" />
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Welcome back</h1>
        <p className="text-zinc-500 mt-1">Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="Email"
          type="email"
          placeholder="you@company.com"
          leftIcon={<Mail size={18} />}
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
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

        <div className="flex justify-end -mt-2">
          <Link to="/forgot-password" className="text-sm text-red-600 hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Sign In
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Don't have an account?{' '}
        <Link to="/register" className="text-red-600 font-medium hover:underline">
          Create account
        </Link>
      </p>
    </AuthLayout>
  );
};
