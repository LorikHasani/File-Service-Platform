import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, Spinner } from '@/components/ui';
import { useServices } from '@/hooks/useSupabase';
import { Settings, Cpu, Info, X } from 'lucide-react';
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
        className="p-1 rounded-full hover:bg-zinc-600/50 transition-colors"
      >
        <Info size={14} className="text-zinc-500 hover:text-zinc-300" />
      </button>
      {show && (
        <div className="absolute top-8 right-0 w-56 p-3 rounded-lg bg-zinc-900 border border-zinc-600 shadow-xl text-xs text-zinc-300 leading-relaxed">
          <div className="absolute -top-1 right-3 w-2 h-2 bg-zinc-900 border-l border-t border-zinc-600 rotate-45" />
          {text}
        </div>
      )}
    </div>
  );
};

export const PricesPage: React.FC = () => {
  const { categories, loading } = useServices();

  const stageCategories = categories.filter((c) => (c as any).selection_type === 'single');
  const optionCategories = categories.filter((c) => (c as any).selection_type !== 'single');

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
          <h1 className="text-3xl font-bold">Service Prices</h1>
          <p className="text-zinc-400 mt-2">Transparent pricing for all our tuning services</p>
        </div>

        {/* Tuning Stages — large cards */}
        {stageCategories.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={20} className="text-blue-400" />
              <h2 className="text-xl font-bold">{cat.name}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.services.map((svc) => (
                <div
                  key={svc.id}
                  className="relative flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-zinc-700 bg-zinc-800/50 text-center"
                >
                  {svc.description && <InfoTooltip text={svc.description} />}
                  <Cpu size={28} className="text-blue-400" />
                  <h3 className="font-bold text-lg mt-1">{svc.name}</h3>
                  <span className="text-2xl font-bold text-blue-400">€{svc.base_price}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Additional Options — grid of boxes */}
        {optionCategories.map((cat) => (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[10px] text-white font-bold">+</span>
              <h2 className="text-xl font-bold">{cat.name}</h2>
              <span className="text-sm text-zinc-500">({cat.services.length} available)</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {cat.services.map((svc) => (
                <div
                  key={svc.id}
                  className="relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-zinc-700 bg-zinc-800/50 text-center transition-all hover:border-zinc-500"
                >
                  {svc.description && <InfoTooltip text={svc.description} />}
                  <Settings size={22} className="text-zinc-500" />
                  <span className="text-xs font-medium leading-tight">{svc.name}</span>
                  <span className="text-sm font-bold text-green-400">+€{svc.base_price}</span>
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
        <div className="flex items-start gap-3 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
          <Info size={20} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-zinc-300">
            All prices are in euros (€). Services are selected during file upload.
            You can combine a tuning stage with multiple additional options.
          </p>
        </div>
      </div>
    </Layout>
  );
};
