import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, User, Building, Phone, MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from '@/components/Layout';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { useWelcomeCredit, formatWelcomeCredit } from '@/hooks/useSupabase';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  contactName: z.string().min(2, 'Name is required'),
  companyName: z.string().min(2, 'Company name is required'),
  phone: z.string().min(5, 'Phone number is required'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const signUp = useAuthStore((s) => s.signUp);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const welcomeCredit = useWelcomeCredit();
  // Set once signup succeeds — switches the page to the "check your email" screen.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const resendConfirmation = async () => {
    if (!sentTo) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: sentTo });
      if (error) toast.error(error.message);
      else toast.success('Confirmation email sent again.');
    } finally {
      setIsResending(false);
    }
  };

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signUp(data.email, data.password, {
        contact_name: data.contactName,
        company_name: data.companyName,
        phone: data.phone,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setSentTo(data.email);
    } finally {
      setIsLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <MailCheck className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Check your email</h1>
          <p className="text-zinc-500 mt-2">
            We sent a confirmation link to{' '}
            <span className="font-semibold text-zinc-900 dark:text-white break-all">{sentTo}</span>.
            Open it to activate your account{welcomeCredit !== null ? ` and your €${formatWelcomeCredit(welcomeCredit)} free credit` : ''}.
          </p>
          <p className="text-sm text-zinc-500 mt-4">
            Nothing after a few minutes? Check your spam folder, or send it again.
          </p>
          <div className="mt-6 space-y-3">
            <Button type="button" variant="secondary" className="w-full" size="lg" isLoading={isResending} onClick={resendConfirmation}>
              Resend confirmation email
            </Button>
            <Button type="button" className="w-full" size="lg" onClick={() => navigate('/login')}>
              I've confirmed — sign in
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <Link to="/" className="mb-8 flex justify-center rounded-xl bg-black px-5 py-5 lg:hidden">
          <img src="/logo-wide.png" alt="ChipTuneFiles" className="w-full max-w-[320px] h-auto" />
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Create your account</h1>
        <p className="text-zinc-500 mt-1">
          {welcomeCredit !== null ? (
            <>Get <span className="font-semibold text-red-600">€{formatWelcomeCredit(welcomeCredit)} free credit</span> to try your first file — no card needed.</>
          ) : (
            'Start tuning with professional ECU file services'
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Full Name"
          placeholder="John Smith"
          leftIcon={<User size={18} />}
          error={errors.contactName?.message}
          {...register('contactName')}
        />

        <Input
          label="Company Name"
          placeholder="Auto Shop Ltd"
          leftIcon={<Building size={18} />}
          error={errors.companyName?.message}
          {...register('companyName')}
        />

        <Input
          label="Phone Number"
          placeholder="+49 151 2345 6789"
          leftIcon={<Phone size={18} />}
          error={errors.phone?.message}
          {...register('phone')}
        />

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
            placeholder="Min. 8 characters"
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
          Create Account
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link to="/login" className="text-red-600 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};
