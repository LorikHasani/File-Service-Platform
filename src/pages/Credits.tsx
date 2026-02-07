import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Zap, Check, ArrowUpRight, ArrowDownRight, Clock, Sparkles, Shield } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Badge, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useCreditPackages, useTransactions } from '@/hooks/useSupabase';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export const CreditsPage: React.FC = () => {
  const profile = useAuthStore((s) => s.profile);
  const { packages, loading: packagesLoading } = useCreditPackages();
  const { transactions, loading: txLoading } = useTransactions();
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle Stripe redirect
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Payment successful! Credits will be added shortly.');
      setSearchParams({}, { replace: true });

      // Refresh profile to get updated balance (webhook may take a moment)
      const refreshBalance = async () => {
        await new Promise((r) => setTimeout(r, 2000));
        await useAuthStore.getState().fetchProfile();
      };
      refreshBalance();
    }
    if (searchParams.get('cancelled') === 'true') {
      toast.error('Payment was cancelled.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleBuy = async (packageId: string) => {
    setBuyingId(packageId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please log in again.');
        return;
      }

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ packageId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setBuyingId(null);
    }
  };

  const popularIndex = packages.length >= 3 ? 2 : -1; // 3rd package = "Business"

  if (packagesLoading) {
    return (
      <Layout title="Credits">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Credits">
      {/* Balance Header */}
      <div className="mb-8">
        <Card className="bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-700 text-white">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-zinc-400 text-sm font-medium">Your Credit Balance</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-bold">{profile?.credit_balance?.toFixed(2) ?? '0.00'}</span>
                <span className="text-zinc-400">credits</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-sm">Secure payments via Stripe</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Section: Packages */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-red-600" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Buy Credits</h2>
        </div>
        <p className="text-zinc-500 mb-6">Choose a credit package. Larger packages include bonus credits.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg, index) => {
            const totalCredits = Number(pkg.credits) + Number(pkg.bonus_credits || 0);
            const pricePerCredit = Number(pkg.price) / totalCredits;
            const isPopular = index === popularIndex;
            const isBuying = buyingId === pkg.id;

            return (
              <div
                key={pkg.id}
                className={`relative rounded-xl border-2 p-5 flex flex-col transition-all ${
                  isPopular
                    ? 'border-red-600 bg-red-50/50 dark:bg-red-900/10 shadow-lg scale-[1.02]'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="error">Most Popular</Badge>
                  </div>
                )}

                <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{pkg.name}</h3>

                <div className="mt-3 mb-1">
                  <span className="text-3xl font-bold text-zinc-900 dark:text-white">€{Number(pkg.price).toFixed(0)}</span>
                </div>

                <div className="text-sm text-zinc-500 mb-4">
                  €{pricePerCredit.toFixed(2)} per credit
                </div>

                <div className="space-y-2 mb-5 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-zinc-700 dark:text-zinc-300">{Number(pkg.credits).toFixed(0)} credits</span>
                  </div>
                  {pkg.bonus_credits > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Zap className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      <span className="text-green-600 font-medium">+{Number(pkg.bonus_credits).toFixed(0)} bonus credits</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                    <span className="text-zinc-500">{totalCredits.toFixed(0)} total credits</span>
                  </div>
                </div>

                <Button
                  variant={isPopular ? 'primary' : 'secondary'}
                  onClick={() => handleBuy(pkg.id)}
                  disabled={!!buyingId}
                  className="w-full"
                >
                  {isBuying ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner size="sm" />
                      Redirecting...
                    </span>
                  ) : (
                    `Buy for €${Number(pkg.price).toFixed(0)}`
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section: Transaction History */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-zinc-500" />
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Transaction History</h2>
        </div>

        {txLoading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner />
          </div>
        ) : transactions.length === 0 ? (
          <Card>
            <p className="text-center text-zinc-500 py-8">No transactions yet. Purchase a credit package to get started.</p>
          </Card>
        ) : (
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">Description</th>
                    <th className="text-left px-4 py-3 text-zinc-500 font-medium">Type</th>
                    <th className="text-right px-4 py-3 text-zinc-500 font-medium">Amount</th>
                    <th className="text-right px-4 py-3 text-zinc-500 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => {
                    const isCredit = tx.type === 'credit_purchase' || tx.type === 'refund' || tx.type === 'admin_adjustment';
                    const typeLabels: Record<string, string> = {
                      credit_purchase: 'Purchase',
                      job_payment: 'Job Payment',
                      refund: 'Refund',
                      admin_adjustment: 'Adjustment',
                    };

                    return (
                      <tr key={tx.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          {format(new Date(tx.created_at), 'dd MMM yyyy, HH:mm')}
                        </td>
                        <td className="px-4 py-3 text-zinc-900 dark:text-white max-w-xs truncate">
                          {tx.description || typeLabels[tx.type] || tx.type}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={isCredit ? 'success' : 'default'}>
                            {typeLabels[tx.type] || tx.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`flex items-center justify-end gap-1 font-medium ${
                            isCredit ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {isCredit ? (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            )}
                            {isCredit ? '+' : '-'}{Math.abs(Number(tx.amount)).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                          {Number(tx.balance_after).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
};
