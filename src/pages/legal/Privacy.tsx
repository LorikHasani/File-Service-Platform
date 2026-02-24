import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-neutral-500 text-sm mb-10">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <div className="prose prose-invert prose-neutral max-w-none space-y-8 text-neutral-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              ChipTuneFiles ("we", "us", "our"), located in Germany, is committed to protecting
              your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your
              personal information when you use our website chiptunefiles.com and related services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            <p>We collect the following types of information:</p>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">Account Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name and contact name</li>
              <li>Email address</li>
              <li>Company name (optional)</li>
              <li>Phone number (optional)</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">Vehicle & Service Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Vehicle information (brand, model, engine, ECU type)</li>
              <li>VIN number (optional)</li>
              <li>Uploaded ECU/TCU files</li>
              <li>Selected tuning services</li>
              <li>Notes and special requests</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">Payment Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Payment transactions are processed by Stripe. We do not store your credit card number,
                 CVV, or full card details on our servers.</li>
              <li>We store transaction records including amounts, dates, and Stripe payment references.</li>
            </ul>

            <h3 className="text-lg font-medium text-white mt-4 mb-2">Technical Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP address, browser type, device information</li>
              <li>Pages visited, time spent on pages</li>
              <li>Referral source</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Provide, maintain, and improve our tuning services</li>
              <li>Process your orders and payments</li>
              <li>Communicate with you about your orders, account, and support requests</li>
              <li>Send service notifications and updates</li>
              <li>Prevent fraud and ensure security of our platform</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Sharing</h2>
            <p>We do not sell your personal information. We share data only with:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong className="text-white">Stripe:</strong> For payment processing. Stripe's privacy policy applies to their handling of your payment data.</li>
              <li><strong className="text-white">Email services:</strong> To send transactional emails (order confirmations, notifications).</li>
              <li><strong className="text-white">Legal requirements:</strong> When required by law, regulation, or legal process.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your data, including encrypted connections
              (HTTPS/TLS), secure authentication, and access controls. Your uploaded files are stored securely
              and accessible only to authorized personnel working on your order.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Uploaded files and job data
              are retained for a reasonable period to allow for revisions and support. You may request
              deletion of your data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Cookies</h2>
            <p>
              We use essential cookies to maintain your session and authentication state. We do not use
              third-party advertising or tracking cookies. By using our site, you consent to our use
              of essential cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict certain data processing</li>
              <li>Data portability</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, please contact us at{' '}
              <a href="mailto:kikzaperformance@gmail.com" className="text-red-400 hover:text-red-300">kikzaperformance@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Children's Privacy</h2>
            <p>
              Our services are not intended for individuals under the age of 18. We do not knowingly
              collect data from minors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of significant
              changes via email or a prominent notice on our website.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Contact Us</h2>
            <p>For privacy-related inquiries:</p>
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
