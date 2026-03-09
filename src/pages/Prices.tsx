import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, Spinner } from '@/components/ui';
import { useServices } from '@/hooks/useSupabase';
import { Settings, Cpu, Info, X, Cog } from 'lucide-react';
import { clsx } from 'clsx';

// Tooltip that shows on hover / click for mobile
const InfoTooltip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);

  return (
    <div className="absolute top-2 right-2 z-10">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-600/50 transition-colors"
      >
        <Info size={14} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300" />
      </button>
      {show && (
        <div className="absolute top-8 right-0 w-56 p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-600 shadow-xl text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
          <div className="absolute -top-1 right-3 w-2 h-2 bg-white dark:bg-zinc-900 border-l border-t border-zinc-200 dark:border-zinc-600 rotate-45" />
          {text}
        </div>
      )}
    </div>
  );
};

export const PricesPage: React.FC = () => {
  const { categories, loading } = useServices();

  // Stage categories: either single-select OR name contains "Tuning"/"Stage"
  // This ensures ECU Performance Tuning + TCU Stages both show as large cards
  const stageCategories = categories.filter((c) => {
    const st = (c as any).selection_type;
    const name = (c.name || '').toLowerCase();
    return st === 'single' || name.includes('tuning') || name.includes('stage');
  });
  const stageCatIds = new Set(stageCategories.map((c) => c.id));
  const optionCategories = categories.filter((c) => !stageCatIds.has(c.id));

  if (loading) {
    return (
      <Layout title="Prices">
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      </Layout>
    );
  }

  return (
    <Layout title="Prices">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Service Prices</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">Transparent pricing for all our tuning services</p>
        </div>

        {/* Performance Tuning — ECU + TCU stages combined */}
        {stageCategories.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Cpu size={20} className="text-blue-500 dark:text-blue-400" />
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Performance Tuning</h2>
            </div>

            {stageCategories.map((cat) => {
              const isTcu = (cat as any).job_type === 'tcu';
              return (
                <div key={cat.id} className="mb-6 last:mb-0">
                  <div className="flex items-center gap-2 mb-3">
                    {isTcu ? <Cog size={16} className="text-purple-500 dark:text-purple-400" /> : <Cpu size={16} className="text-blue-500 dark:text-blue-400" />}
                    <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                      {isTcu ? 'Gearbox / TCU' : 'ECU'}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {cat.services.map((svc) => (
                      <div
                        key={svc.id}
                        className={clsx(
                          'relative flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 text-center',
                          isTcu
                            ? 'border-purple-200 dark:border-purple-700/50 bg-purple-50 dark:bg-purple-900/10'
                            : 'border-blue-200 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/10'
                        )}
                      >
                        {svc.description && <InfoTooltip text={svc.description} />}
                        {isTcu
                          ? <Cog size={20} className="text-purple-500 dark:text-purple-400" />
                          : <Cpu size={20} className="text-blue-500 dark:text-blue-400" />
                        }
                        <h3 className="font-semibold text-sm text-zinc-900 dark:text-white">{svc.name}</h3>
                        <span className={clsx('text-lg font-bold', isTcu ? 'text-purple-500 dark:text-purple-400' : 'text-blue-500 dark:text-blue-400')}>
                          €{svc.base_price}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Additional Options — grid of boxes */}
        {optionCategories.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white font-bold">+</span>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{cat.name}</h2>
              <span className="text-sm text-zinc-500">({cat.services.length} available)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {cat.services.map((svc) => (
                <div
                  key={svc.id}
                  className="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50 text-center transition-all hover:border-zinc-300 dark:hover:border-zinc-500"
                >
                  {svc.description && <InfoTooltip text={svc.description} />}
                  <Settings size={22} className="text-zinc-400 dark:text-zinc-500" />
                  <span className="text-xs font-medium leading-tight text-zinc-700 dark:text-zinc-300">{svc.name}</span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">+€{svc.base_price}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Empty */}
        {categories.length === 0 && (
          <Card>
            <div className="text-center py-12 text-zinc-500">
              <p className="text-lg">No services available yet.</p>
              <p className="text-sm mt-1">Check back soon!</p>
            </div>
          </Card>
        )}

        {/* Note */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-zinc-800/50 border border-blue-200 dark:border-zinc-700">
          <Info size={20} className="text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            All prices are in euros (€). Services are selected during file upload.
            You can combine a tuning stage with multiple additional options.
          </p>
        </div>
      </div>
    </Layout>
  );
};
