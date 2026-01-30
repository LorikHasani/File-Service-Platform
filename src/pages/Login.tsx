import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, Gauge } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from '@/components/Layout';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Welcome back!');
      
      // Wait for profile to load and check admin status
      setTimeout(() => {
        const state = useAuthStore.getState();
        navigate(state.isAdmin ? '/admin' : '/dashboard');
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-8">
        <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
          <Gauge className="w-8 h-8 text-red-600" />
          <span className="text-xl font-bold">TuneForge</span>
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
