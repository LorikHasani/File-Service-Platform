import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Gauge, Zap, Shield, Clock, ArrowRight, Check,
  ChevronRight, Mail, Phone, MapPin, Send, Menu, X,
  Settings, Flame, Cpu, TrendingUp,
} from 'lucide-react';

// ─── Calculator iframe ───

const calcIframe = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent; font-family: system-ui, -apple-system, sans-serif; }
    #ecuCalculateTool { width: 100%; }
  </style>
  <script>
    window.$ecu = {
      lang: "eng",
      width: "100%",
      BackgroundColor: "#0a0a0a",
      BoxColor: "#141414",
      FontColor: "#ffffff",
      ButtonColor: "#dc2626",
      ButtonFontColor: "#ffffff",
      APIID: ""
    };
  <\/script>
</head>
<body>
  <div id="ecuCalculateTool"></div>
  <script src="https://xremover.net/calculator/ecuob.js"><\/script>
</body>
</html>`.trim();

// ─── Data ───

const services = [
  { name: 'Stage 1 Remap', desc: 'Optimized ECU calibration for stock hardware. Safe power gains up to 30%.', icon: <Zap className="w-5 h-5" /> },
  { name: 'Stage 2 Remap', desc: 'For vehicles with intake and exhaust upgrades. Up to 45% more power.', icon: <TrendingUp className="w-5 h-5" /> },
  { name: 'Stage 3 Remap', desc: 'Full custom calibration for heavily modified engines.', icon: <Flame className="w-5 h-5" /> },
  { name: 'DPF Off', desc: 'Diesel Particulate Filter removal. Eliminates regeneration cycles.', icon: <Settings className="w-5 h-5" /> },
  { name: 'AdBlue / SCR Off', desc: 'SCR system delete. No more AdBlue refills or warning lights.', icon: <Shield className="w-5 h-5" /> },
  { name: 'EGR Off', desc: 'Exhaust Gas Recirculation delete. Prevents carbon buildup.', icon: <Cpu className="w-5 h-5" /> },
  { name: 'Pop & Bang', desc: 'Aggressive exhaust crackle and pops on overrun and deceleration.', icon: <Flame className="w-5 h-5" /> },
  { name: 'Popcorn / Hardcut', desc: 'Rev limiter pops and burble map. Continuous crackle effect.', icon: <Zap className="w-5 h-5" /> },
];

const extraServices = [
  'Lambda / O2 Off', 'Swirl Flaps Off', 'Hot Start Fix', 'Speed Limiter Off',
  'Start-Stop Disable', 'Launch Control', 'Intake Flaps Off', 'EVAP Off',
  'Torque Monitoring Off', 'TVA Off', 'GPF / OPF Off', 'Decat / Cat Off',
];

// ─── Component ───

export const LandingPage: React.FC = () => {
  const [mobileNav, setMobileNav] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div className="bg-neutral-950 text-white min-h-screen">

      {/* ═══ HEADER ═══ */}
      <header
        role="banner"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-neutral-950/90 backdrop-blur-xl border-b border-white/5'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between h-16">
          <a href="#top" className="flex items-center gap-2" aria-label="ChipTuneFiles home">
            <img src="/logo.png" alt="ChipTuneFiles" className="h-8" />
          </a>

          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-neutral-400" aria-label="Main navigation">
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#calculator" className="hover:text-white transition-colors">Calculator</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-[13px] font-semibold text-neutral-400 hover:text-white transition-colors px-4 py-2">
              File Portal Login
            </Link>
            <Link to="/register" className="text-[13px] font-semibold bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-lg transition-colors">
              Register
            </Link>
          </div>

          <button onClick={() => setMobileNav(!mobileNav)} className="md:hidden p-2 text-neutral-400" aria-label="Toggle menu">
            {mobileNav ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileNav && (
          <div className="md:hidden bg-neutral-950/98 backdrop-blur-xl border-t border-white/5 px-5 py-6 space-y-3">
            <a href="#services" onClick={() => setMobileNav(false)} className="block py-2 text-neutral-300">Services</a>
            <a href="#how-it-works" onClick={() => setMobileNav(false)} className="block py-2 text-neutral-300">How It Works</a>
            <a href="#calculator" onClick={() => setMobileNav(false)} className="block py-2 text-neutral-300">Calculator</a>
            <a href="#contact" onClick={() => setMobileNav(false)} className="block py-2 text-neutral-300">Contact</a>
            <div className="pt-4 border-t border-white/10 space-y-3">
              <Link to="/login" className="block text-center py-3 text-sm font-semibold border border-white/10 rounded-lg text-neutral-300">File Portal Login</Link>
              <Link to="/register" className="block text-center py-3 text-sm font-semibold bg-red-600 rounded-lg text-white">Register</Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══ HERO ═══ */}
      <section id="top" className="relative min-h-[100vh] flex items-center overflow-hidden" aria-label="Hero">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1920&q=80"
            alt="High performance sports car on road representing ECU tuning potential"
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/85 to-neutral-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/30" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 py-32 lg:py-40">
          <div className="max-w-xl">
            <p className="text-red-500 text-sm font-semibold tracking-widest uppercase mb-6">
              Professional ECU File Service
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-6">
              Unlock Your Engine's Full Potential
            </h1>

            <p className="text-neutral-400 text-lg leading-relaxed mb-10 max-w-md">
              Premium tuning files for workshops and tuners.
              Stage 1–3 remaps, DPF, EGR, AdBlue solutions — delivered fast.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-14">
              <Link
                to="/register"
                className="group inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-7 py-3.5 rounded-lg transition-all"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center gap-2 border border-white/15 hover:border-white/30 text-neutral-300 hover:text-white font-semibold px-7 py-3.5 rounded-lg transition-all"
              >
                View Services
              </a>
            </div>

            {/* Minimal stats */}
            <div className="flex gap-10 text-sm">
              <div>
                <div className="text-2xl font-extrabold">10k+</div>
                <div className="text-neutral-500">Files Delivered</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold">&lt;1h</div>
                <div className="text-neutral-500">Turnaround</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold">24/7</div>
                <div className="text-neutral-500">Support</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SERVICES ═══ */}
      <section id="services" className="py-24 lg:py-32" aria-label="Our tuning services">
        <div className="max-w-6xl mx-auto px-5">
          <p className="text-red-500 text-sm font-semibold tracking-widest uppercase mb-3">Services</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">What We Offer</h2>
          <p className="text-neutral-400 max-w-lg mb-14">
            From ECU remapping to emission solutions — everything your workshop needs.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden">
            {services.map((s) => (
              <article key={s.name} className="bg-neutral-950 p-6 hover:bg-neutral-900/50 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-4 text-red-500 group-hover:bg-red-600/10 transition-colors">
                  {s.icon}
                </div>
                <h3 className="font-bold mb-1.5">{s.name}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{s.desc}</p>
              </article>
            ))}
          </div>

          {/* Extra services */}
          <div className="mt-10 flex flex-wrap gap-2">
            <span className="text-sm text-neutral-500 mr-1 py-1">Also available:</span>
            {extraServices.map((s) => (
              <span key={s} className="text-xs font-medium text-neutral-400 bg-white/5 px-3 py-1 rounded-full">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CAR IMAGE DIVIDER ═══ */}
      <section className="relative h-[50vh] lg:h-[60vh] overflow-hidden" aria-hidden="true">
        <img
          src="https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=1920&q=80"
          alt="Powerful sports car engine bay showcasing performance tuning"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950 via-transparent to-neutral-950" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-5xl sm:text-7xl font-black tracking-tight opacity-90">
              More <span className="text-red-500">Power.</span>
            </p>
            <p className="text-5xl sm:text-7xl font-black tracking-tight opacity-90 mt-1">
              More <span className="text-red-500">Torque.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" className="py-24 lg:py-32" aria-label="How it works">
        <div className="max-w-6xl mx-auto px-5">
          <p className="text-red-500 text-sm font-semibold tracking-widest uppercase mb-3">Process</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">How It Works</h2>
          <p className="text-neutral-400 max-w-lg mb-14">
            Three steps from upload to tuned file. Simple, fast, professional.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[
              {
                num: '01',
                title: 'Register & Upload',
                desc: 'Create your account, fill in vehicle details, select the services you need, and upload your original ECU file.',
              },
              {
                num: '02',
                title: 'We Tune Your File',
                desc: 'Our experienced engineers calibrate your file with precision. Most files are ready in under 1 hour.',
              },
              {
                num: '03',
                title: 'Download & Flash',
                desc: 'Get an instant email notification. Download your tuned file from the portal and flash it to the vehicle.',
              },
            ].map((step, i) => (
              <article key={step.num} className="relative">
                <div className="text-[80px] font-black text-white/[0.03] leading-none select-none">{step.num}</div>
                <div className="mt-[-30px] relative">
                  <div className="w-8 h-px bg-red-600 mb-5" />
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{step.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CALCULATOR ═══ */}
      <section id="calculator" className="py-24 lg:py-32 bg-neutral-900/30" aria-label="Performance calculator">
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-12">
            <p className="text-red-500 text-sm font-semibold tracking-widest uppercase mb-3">Free Tool</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Performance Calculator</h2>
            <p className="text-neutral-400 max-w-lg mx-auto">
              Select your vehicle and see the potential power and torque gains.
            </p>
          </div>

          <div className="rounded-2xl border border-white/5 overflow-hidden">
            <iframe
              srcDoc={calcIframe}
              className="w-full border-0"
              style={{ height: '600px' }}
              title="ECU Performance Calculator — Calculate power gains for your vehicle"
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ═══ WHY US — minimal ═══ */}
      <section className="py-24 lg:py-32" aria-label="Why choose ChipTuneFiles">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            {/* Image */}
            <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
              <img
                src="https://images.unsplash.com/photo-1619405399517-d7fce0f13302?auto=format&fit=crop&w=960&q=80"
                alt="ECU tuning specialist working on engine management system"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/60 to-transparent" />
            </div>

            {/* Text */}
            <div>
              <p className="text-red-500 text-sm font-semibold tracking-widest uppercase mb-3">Why Us</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-6">
                Trusted by Professionals Worldwide
              </h2>
              <p className="text-neutral-400 leading-relaxed mb-8">
                Every file is handcrafted by experienced engineers — no automated solutions.
                We deliver tested, safe, and reliable tuning files.
              </p>

              <div className="space-y-4">
                {[
                  'Experienced engineers with 10+ years in ECU calibration',
                  'Files tested on dyno before delivery',
                  'Average turnaround time under 1 hour',
                  '24/7 support via WhatsApp, email, and portal',
                  'Simple pricing in euros — pay only for what you need',
                  'Secure file transfers with encrypted storage',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <Check className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-neutral-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <section id="contact" className="py-24 lg:py-32 bg-neutral-900/30" aria-label="Contact us">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* Info */}
            <div>
              <p className="text-red-500 text-sm font-semibold tracking-widest uppercase mb-3">Contact</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Get in Touch</h2>
              <p className="text-neutral-400 leading-relaxed mb-10 max-w-md">
                Have questions about our services? Need a custom solution? We're here to help.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500 mb-0.5">Email</p>
                    <a href="mailto:kikzaperformance@gmail.com" className="text-white hover:text-red-400 transition-colors font-medium">
                      kikzaperformance@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500 mb-0.5">WhatsApp</p>
                    <a href="https://wa.me/491623900543" className="text-white hover:text-red-400 transition-colors font-medium">
                      +49 162 3900543
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500 mb-0.5">Working Hours</p>
                    <p className="text-white font-medium">24/7 — Always available</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-neutral-500 mb-0.5">Location</p>
                    <p className="text-white font-medium">Germany</p>
                    <p className="text-sm text-neutral-500">Serving clients worldwide</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div>
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const data = new FormData(form);
                  const name = data.get('name');
                  const email = data.get('email');
                  const message = data.get('message');
                  // Open mailto with prefilled data
                  window.location.href = `mailto:kikzaperformance@gmail.com?subject=Inquiry from ${name}&body=${message}%0A%0AFrom: ${name} (${email})`;
                }}
              >
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-neutral-400 mb-1.5">Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    placeholder="Your name"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/50 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    placeholder="your@email.com"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/50 transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-neutral-400 mb-1.5">Message</label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    placeholder="How can we help you?"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-red-600/50 focus:ring-1 focus:ring-red-600/50 transition-colors resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-3.5 rounded-lg transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="py-24 lg:py-32" aria-label="Get started">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Ready to Start Tuning?
          </h2>
          <p className="text-neutral-400 max-w-md mx-auto mb-8">
            Join thousands of workshops and tuners who trust ChipTuneFiles.
            No subscription — pay only for what you need.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold px-8 py-3.5 rounded-lg transition-all"
            >
              Create Free Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 border border-white/10 hover:border-white/25 text-neutral-300 hover:text-white font-semibold px-8 py-3.5 rounded-lg transition-all"
            >
              File Portal Login
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/5 py-10" role="contentinfo">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="ChipTuneFiles" className="h-6" />
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-500" aria-label="Footer navigation">
              <a href="#services" className="hover:text-white transition-colors">Services</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <a href="#contact" className="hover:text-white transition-colors">Contact</a>
              <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link>
              <Link to="/login" className="hover:text-white transition-colors">Portal</Link>
            </nav>

            <p className="text-xs text-neutral-600">
              © {new Date().getFullYear()} chiptunefiles.com — All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
