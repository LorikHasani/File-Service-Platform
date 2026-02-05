import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Card, Spinner } from '@/components/ui';
import { Gauge, Zap, TrendingUp, Fuel, Shield } from 'lucide-react';

export const PerformanceCalculatorPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Create iframe content with the calculator
    const iframeContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            background: #18181b; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 16px;
          }
        </style>
      </head>
      <body>
        <div id="ecuCalculateTool"></div>
        <script>
          window.$ecu = {
            lang: "eng",
            width: "100%",
            BackgroundColor: "#18181b",
            BoxColor: "#27272a",
            FontColor: "#ffffff",
            ButtonColor: "#dc2626",
            ButtonFontColor: "#ffffff",
            APIID: ""
          };
        </script>
        <script src="https://xremover.net/calculator/ecuob.js?_=${Date.now()}" async></script>
      </body>
      </html>
    `;

    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(iframeContent);
        doc.close();
        
        // Wait for iframe to load
        iframe.onload = () => setLoading(false);
        setTimeout(() => setLoading(false), 2000); // Fallback
      }
    }
  }, []);

  return (
    <Layout title="Performance Calculator">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 mb-4">
            <Gauge className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
            Performance Calculator
          </h1>
          <p className="text-zinc-500 max-w-lg mx-auto">
            Discover the potential power gains for your vehicle with professional ECU tuning
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 mb-2">
              <Zap className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">+30%</p>
            <p className="text-xs text-zinc-500">Avg. Power Gain</p>
          </Card>
          
          <Card className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">+40%</p>
            <p className="text-xs text-zinc-500">Avg. Torque Gain</p>
          </Card>
          
          <Card className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 mb-2">
              <Fuel className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">-15%</p>
            <p className="text-xs text-zinc-500">Fuel Savings</p>
          </Card>
          
          <Card className="text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 mb-2">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-white">100%</p>
            <p className="text-xs text-zinc-500">Safe & Tested</p>
          </Card>
        </div>

        {/* Calculator Container */}
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
            <h2 className="font-semibold text-zinc-900 dark:text-white">
              Select Your Vehicle
            </h2>
            <p className="text-sm text-zinc-500">
              Choose your vehicle details to calculate potential performance gains
            </p>
          </div>
          
          {/* Calculator Widget in Isolated Iframe */}
          <div className="relative bg-zinc-900">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10">
                <Spinner size="lg" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              title="ECU Performance Calculator"
              className="w-full border-0"
              style={{ height: '450px', minHeight: '450px' }}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Stage 1 Tuning</h3>
            <p className="text-sm text-zinc-500">
              ECU software optimization only. No hardware modifications required. 
              Typical gains: 15-30% more power.
            </p>
          </Card>
          
          <Card>
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Stage 2 Tuning</h3>
            <p className="text-sm text-zinc-500">
              Enhanced ECU tune with intake and exhaust upgrades. 
              Typical gains: 25-45% more power.
            </p>
          </Card>
          
          <Card>
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">Custom Solutions</h3>
            <p className="text-sm text-zinc-500">
              DPF, EGR, AdBlue solutions and more. 
              Tailored to your specific requirements.
            </p>
          </Card>
        </div>

        {/* CTA */}
        <Card className="bg-gradient-to-r from-red-600 to-red-700 text-white text-center">
          <h3 className="text-xl font-bold mb-2">Ready to unlock your car's potential?</h3>
          <p className="text-red-100 mb-4">
            Submit a tuning request and our experts will create a custom tune for your vehicle
          </p>
          <a 
            href="/jobs/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-red-600 font-semibold rounded-xl hover:bg-red-50 transition-colors"
          >
            Start Tuning Request
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </Card>

        {/* Disclaimer */}
        <p className="text-xs text-zinc-400 text-center">
          * Results are estimates based on typical tuning outcomes. Actual gains may vary depending on 
          vehicle condition, fuel quality, ambient conditions, and other factors. 
          All tuning is performed at the vehicle owner's risk.
        </p>
      </div>
    </Layout>
  );
};
