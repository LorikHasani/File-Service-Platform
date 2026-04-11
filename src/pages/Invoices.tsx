import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, List, Download } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Card, Button, Badge, Spinner, Pagination, usePagination } from '@/components/ui';
import { useTransactions } from '@/hooks/useSupabase';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import { generateInvoicePDF, formatInvoiceNumber } from '@/lib/invoice';
import type { Transaction } from '@/types/database';
import toast from 'react-hot-toast';

export const InvoicesPage: React.FC = () => {
  const profile = useAuthStore((s) => s.profile);
  const { transactions, loading } = useTransactions();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Every credit purchase becomes an invoice in this view.
  const invoices = useMemo(
    () =>
      (transactions || []).filter(
        (tx) => tx.type === 'credit_purchase' && Number(tx.amount) > 0,
      ),
    [transactions],
  );

  const {
    page,
    setPage,
    totalPages,
    totalItems,
    rangeStart,
    rangeEnd,
    pagedItems: pageInvoices,
  } = usePagination(invoices, 10);

  const handleDownload = async (tx: Transaction) => {
    if (!profile) return;
    setDownloadingId(tx.id);
    try {
      await generateInvoicePDF(tx, {
        contact_name: profile.contact_name,
        company_name: profile.company_name,
        country: profile.country,
        email: profile.email,
      });
    } catch (err) {
      console.error('Invoice PDF generation failed', err);
      toast.error('Failed to generate invoice PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <Layout title="Invoices">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Invoices">
      <Card padding="none">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-6 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h1 className="text-xl font-bold">Invoices</h1>
            <p className="text-sm text-zinc-500 mt-1">Pay and download your invoices</p>
          </div>
          <Link to="/credits" className="sm:shrink-0">
            <Button variant="outline">
              <List size={16} />
              View transaction list
            </Button>
          </Link>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Receipt className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No invoices yet</h3>
            <p className="text-sm text-zinc-500">
              Purchase credits to receive your first invoice.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-zinc-500">#</th>
                    <th className="px-6 py-4 text-left font-semibold text-zinc-500">Date</th>
                    <th className="px-6 py-4 text-left font-semibold text-zinc-500">Total</th>
                    <th className="px-6 py-4 text-left font-semibold text-zinc-500">Status</th>
                    <th className="px-6 py-4 text-left font-semibold text-zinc-500">Details</th>
                    <th className="px-6 py-4 text-right font-semibold text-zinc-500"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {pageInvoices.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-zinc-400 font-medium">
                        {formatInvoiceNumber(tx)}
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                        {format(new Date(tx.created_at), 'd/M/yyyy')}
                      </td>
                      <td className="px-6 py-4 font-bold text-zinc-900 dark:text-white">
                        €{Number(tx.amount).toFixed(0)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="success">Paid</Badge>
                      </td>
                      <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                        Tuning file credits
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(tx)}
                          disabled={downloadingId === tx.id}
                          isLoading={downloadingId === tx.id}
                        >
                          <Download size={14} />
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </Card>
    </Layout>
  );
};
