import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from '@/components/Layout';
import { Button, Input } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

type FormData = z.infer<typeof schema>;

export const ForgotPasswordPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
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
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
            <MailCheck className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Check your email</h1>
          <p className="text-zinc-500 mb-1">
            If an account exists for <strong>{sentTo}</strong>, we've sent a link to reset your password.
          </p>
          <p className="text-sm text-zinc-400 mb-8">
            Didn't get it? Check your spam folder, or try again in a minute.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 text-red-600 font-medium hover:underline">
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-8">
        <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
          <img src="/logo.png" alt="ChipTuneFiles" className="h-8" />
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Forgot your password?</h1>
        <p className="text-zinc-500 mt-1">
          Enter your account email and we'll send you a link to set a new one.
        </p>
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

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Send reset link
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Remembered it?{' '}
        <Link to="/login" className="text-red-600 font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
};
