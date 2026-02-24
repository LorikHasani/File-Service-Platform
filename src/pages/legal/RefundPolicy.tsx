import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const RefundPolicyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/5">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ChipTuneFiles" className="h-6" />
          </Link>
          <Link to="/" className="text-sm text-neutral-400 hover:text-white flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-12">
        <h1 className="text-3xl font-bold mb-2">Refund Policy</h1>
        <p className="text-neutral-500 text-sm mb-10">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <div className="prose prose-invert prose-neutral max-w-none space-y-8 text-neutral-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Overview</h2>
            <p>
              At ChipTuneFiles, we strive to provide high-quality tuning files and excellent customer service.
              This Refund Policy outlines the conditions under which you may request a refund for services
              purchased through our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Eligibility for Refunds</h2>
            <p>You may be eligible for a refund in the following situations:</p>

            <div className="mt-4 space-y-4">
              <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/5">
                <h3 className="font-semibold text-green-400 mb-2">✓ Full Refund</h3>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>You cancel your order <strong className="text-white">before</strong> our team starts working on your file.</li>
                  <li>We are unable to provide the requested tuning service for your specific vehicle/ECU combination.</li>
                  <li>A technical error on our platform prevents delivery of the service.</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
                <h3 className="font-semibold text-yellow-400 mb-2">⚬ Partial Refund or Credit</h3>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>The delivered file does not perform as described, and we cannot resolve the issue after reasonable attempts (including revisions).</li>
                  <li>You experience issues that our support team cannot resolve through file adjustments.</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                <h3 className="font-semibold text-red-400 mb-2">✗ Not Eligible for Refund</h3>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>The file has been downloaded and/or flashed to the vehicle.</li>
                  <li>You provided incorrect vehicle information, corrupted original files, or wrong ECU data.</li>
                  <li>You changed your mind after the file has been completed and delivered.</li>
                  <li>Issues caused by third-party tools, incorrect flashing procedures, or hardware problems.</li>
                  <li>The vehicle has pre-existing mechanical or electrical issues unrelated to the tuning file.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Free Revisions</h2>
            <p>
              Before requesting a refund, we encourage you to use our <strong className="text-white">free revision service</strong>.
              If the tuned file doesn't meet your expectations, our team will adjust it at no additional cost.
              Please describe the issue in detail so we can address it effectively.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. How to Request a Refund</h2>
            <p>To request a refund:</p>
            <ol className="list-decimal pl-6 mt-2 space-y-2">
              <li>Contact us via email at <a href="mailto:kikzaperformance@gmail.com" className="text-red-400 hover:text-red-300">kikzaperformance@gmail.com</a> or WhatsApp at <a href="https://wa.me/491623900543" className="text-red-400 hover:text-red-300">+49 162 3900543</a>.</li>
              <li>Include your order reference number and a description of the issue.</li>
              <li>Our team will review your request within <strong className="text-white">24–48 hours</strong>.</li>
              <li>If approved, the refund will be processed to your original payment method or as account credit.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Refund Processing</h2>
            <p>
              Approved refunds will be processed within <strong className="text-white">5–10 business days</strong>.
              Refunds are issued to the original payment method used at the time of purchase.
              Please note that your bank or card issuer may take additional time to reflect the refund.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Account Balance</h2>
            <p>
              Funds added to your account balance can be refunded if they have not been used for any services.
              Once balance funds have been applied to an order, the refund eligibility depends on the
              order status as described in Section 2.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Disputes</h2>
            <p>
              We encourage you to contact us directly before initiating a payment dispute (chargeback)
              with your bank or card issuer. We are committed to resolving issues promptly and fairly.
              Chargebacks initiated without first contacting us may result in account suspension.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Contact Us</h2>
            <p>For refund requests or questions about this policy:</p>
            <ul className="mt-3 space-y-1">
              <li>Email: <a href="mailto:kikzaperformance@gmail.com" className="text-red-400 hover:text-red-300">kikzaperformance@gmail.com</a></li>
              <li>WhatsApp: <a href="https://wa.me/491623900543" className="text-red-400 hover:text-red-300">+49 162 3900543</a></li>
              <li>Address: Germany</li>
            </ul>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/5 py-6">
        <div className="max-w-4xl mx-auto px-5 flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-500">
          <Link to="/terms" className="hover:text-white">Terms of Service</Link>
          <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link to="/refund-policy" className="hover:text-white">Refund Policy</Link>
          <Link to="/" className="hover:text-white">Home</Link>
        </div>
      </footer>
    </div>
  );
};
