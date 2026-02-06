import React from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui";
import { Gauge, Zap, TrendingUp, Fuel, Shield } from "lucide-react";

export const PerformanceCalculatorPage: React.FC = () => {
  // Create the iframe content with the calculator
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
      font-family: system-ui, -apple-system, sans-serif;
      
    }
    #ecuCalculateTool { width: 100%; }
  </style>
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
</head>
<body>
  <div id="ecuCalculateTool"></div>
  <script src="https://xremover.net/calculator/ecuob.js"></script>
</body>
</html>
  `.trim();

  return (
    <Layout title="Performance Calculator">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <Gauge className="w-7 h-7 text-red-600" />
            Performance Calculator
          </h2>
          <p className="text-zinc-500 mt-2">
            Calculate potential power gains for your vehicle with our tuning
            services.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="text-center">
            <Zap className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              Power Gains
            </h3>
            <p className="text-sm text-zinc-500">Up to 30% more HP</p>
          </Card>
          <Card className="text-center">
            <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              Torque Boost
            </h3>
            <p className="text-sm text-zinc-500">Improved response</p>
          </Card>
          <Card className="text-center">
            <Fuel className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              Fuel Economy
            </h3>
            <p className="text-sm text-zinc-500">Better efficiency</p>
          </Card>
          <Card className="text-center">
            <Shield className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              Safe Tuning
            </h3>
            <p className="text-sm text-zinc-500">Within limits</p>
          </Card>
        </div>

        {/* Calculator Widget - Isolated in iframe */}
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 md:p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Select Your Vehicle
            </h3>
            <p className="text-sm text-zinc-500 mt-1">
              Choose your vehicle details to see potential performance gains
            </p>
          </div>

          {/* Iframe for style isolation */}
          <div className="bg-zinc-900">
            <iframe
              srcDoc={iframeContent}
              className="w-full border-0"
              style={{ height: "600px" }}
              title="ECU Performance Calculator"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </Card>

        {/* Disclaimer */}
        <div className="mt-6 p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <strong>Disclaimer:</strong> Results shown are estimates based on
            typical gains. Actual results may vary depending on vehicle
            condition, fuel quality, and other factors. All tuning is performed
            within safe parameters to protect your engine.
          </p>
        </div>
      </div>
    </Layout>
  );
};
