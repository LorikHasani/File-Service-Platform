import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const TermsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
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
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-neutral-500 text-sm mb-10">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <div className="prose prose-invert prose-neutral max-w-none space-y-8 text-neutral-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              Welcome to ChipTuneFiles ("we", "us", "our"), operated by ChipTuneFiles, located in Germany.
              These Terms of Service ("Terms") govern your access to and use of our website at chiptunefiles.com
              and all related services, including ECU and TCU file tuning services (collectively, the "Service").
            </p>
            <p className="mt-3">
              By creating an account, uploading files, or making a purchase, you agree to be bound by these Terms.
              If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Service Description</h2>
            <p>
              ChipTuneFiles provides professional ECU (Engine Control Unit) and TCU (Transmission Control Unit)
              tuning file services. Customers upload their original vehicle ECU/TCU files through our platform,
              select desired tuning options, and receive modified files optimized for performance, fuel efficiency,
              or other requested parameters.
            </p>
            <p className="mt-3">
              Our services include but are not limited to: Stage 1 and Stage 2 tuning, DPF/FAP removal,
              EGR removal, AdBlue/SCR solutions, DSG/TCU tuning, and various additional tuning options
              as listed on our Prices page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Account Registration</h2>
            <p>
              To use our services, you must create an account and provide accurate, complete information.
              You are responsible for maintaining the confidentiality of your account credentials and for
              all activity under your account. You must notify us immediately of any unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Pricing and Payment</h2>
            <p>
              All prices are displayed in euros (€) on our website. Payments are processed securely
              through Stripe. By making a purchase, you agree to pay the applicable fees for the
              services you select.
            </p>
            <p className="mt-3">
              You may add funds to your account balance, which can then be used to pay for tuning services.
              The balance is non-transferable and cannot be exchanged for cash except as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Service Delivery</h2>
            <p>
              After you submit a tuning request and payment is processed, our team will work on your file.
              Typical turnaround time varies depending on complexity and current workload.
              You will be notified via email when your modified file is ready for download.
            </p>
            <p className="mt-3">
              We make every effort to deliver high-quality tuning files, but results may vary depending
              on your specific vehicle, hardware, and conditions. We are not responsible for any damage
              caused by improper installation or use of modified files.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Customer Responsibilities</h2>
            <p>You agree that:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>You are the legal owner or authorized representative of the vehicle being tuned.</li>
              <li>You understand that ECU/TCU modifications may affect vehicle warranty and emissions compliance.</li>
              <li>You will comply with all local laws and regulations regarding vehicle modifications in your jurisdiction.</li>
              <li>You are responsible for verifying that modifications are legal for use in your country or region.</li>
              <li>The uploaded files are read correctly using a supported tool and are not corrupted.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Refund Policy</h2>
            <p>
              Please see our dedicated <Link to="/refund-policy" className="text-red-400 hover:text-red-300 underline">Refund Policy</Link> page
              for full details on refunds and cancellations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p>
              All tuning files, software, content, and materials provided through the Service are the
              property of ChipTuneFiles or its licensors. You may not redistribute, resell, or share
              modified files received from our service without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, ChipTuneFiles shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your use of the Service,
              including but not limited to damage to vehicles, loss of data, or loss of profits.
            </p>
            <p className="mt-3">
              Our total liability for any claim arising from the Service shall not exceed the amount
              you paid for the specific service giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time if we believe
              you have violated these Terms or engaged in fraudulent activity. Upon termination,
              any remaining balance may be refunded at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify registered users of significant
              changes via email. Your continued use of the Service after changes are posted constitutes
              your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Contact Information</h2>
            <p>
              If you have questions about these Terms, please contact us:
            </p>
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
