import React, { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, Gauge, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { AuthLayout } from '@/components/Layout';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b} = ?`, answer: a + b };
}

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaVerified, setCaptchaVerified] = useState(false);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaInput('');
    setCaptchaVerified(false);
  }, []);

  useEffect(() => {
    if (captchaInput && Number(captchaInput) === captcha.answer) {
      setCaptchaVerified(true);
    } else {
      setCaptchaVerified(false);
    }
  }, [captchaInput, captcha.answer]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    if (!captchaVerified) {
      toast.error('Please solve the CAPTCHA correctly');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);

      if (error) {
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
        <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
          <img src="/logo.png" alt="ChipTuneFiles" className="h-8" />
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

        {/* CAPTCHA */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={18} className={captchaVerified ? 'text-green-500' : 'text-zinc-400'} />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Verify you're not a robot</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-zinc-900 dark:text-white whitespace-nowrap">{captcha.question}</span>
            <input
              type="number"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              placeholder="Answer"
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="button"
              onClick={refreshCaptcha}
              className="text-xs text-red-600 hover:underline whitespace-nowrap"
            >
              New question
            </button>
          </div>
          {captchaVerified && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <ShieldCheck size={14} /> Verified
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading} disabled={!captchaVerified}>
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
