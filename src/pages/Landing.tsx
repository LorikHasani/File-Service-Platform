import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Mail,
  Phone,
  Send,
  Menu,
  X,
  Clock,
  FileUp,
  Wrench,
  Download,
  ShieldCheck,
  RefreshCcw,
  Wallet,
  Users,
} from "lucide-react";
import { KikzaCredit } from "@/components/KikzaCredit";

// ─── Calculator iframe ───

const calcIframe = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: transparent; font-family: Inter, system-ui, -apple-system, sans-serif; }
    #ecuCalculateTool { width: 100%; }
  </style>
  <script>
    window.$ecu = {
      lang: "eng",
      width: "100%",
      BackgroundColor: "#ffffff",
      BoxColor: "#f8fafc",
      FontColor: "#0f172a",
      ButtonColor: "#b91c1c",
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

const serviceGroups = [
  {
    title: "Performance calibration",
    items: [
      ["Stage 1", "Calibration for stock hardware. Typically 15–30% more power and torque."],
      ["Stage 2", "For vehicles with intake, intercooler or exhaust upgrades. Up to 45%."],
      ["Stage 3", "Custom calibration for heavily modified engines."],
      ["TCU / Gearbox", "DSG, ZF and other automatics: shift times, torque limits, launch."],
    ],
  },
  {
    title: "Emission system solutions",
    items: [
      ["DPF / GPF / OPF", "Particulate filter removal and regeneration disable."],
      ["EGR", "Exhaust gas recirculation delete."],
      ["AdBlue / SCR", "SCR system delete including warning and countdown logic."],
      ["Lambda / Decat", "O2 sensor and catalyst monitoring removal."],
    ],
  },
  {
    title: "Additional options",
    items: [
      ["Speed limiter", "Removal or adjustment of the factory Vmax limit."],
      ["Start-Stop", "Permanent disable of the start-stop system."],
      ["Pops & Bangs", "Overrun burble and hardcut maps."],
      ["Launch control", "Launch control and rev-limit adjustments."],
    ],
  },
];

const extraServices = [
  "Swirl Flaps Off",
  "Hot Start Fix",
  "Intake Flaps Off",
  "EVAP Off",
  "Torque Monitoring Off",
  "TVA Off",
];

const tools = [
  "KESS",
  "KTAG",
  "Autotuner",
  "CMD Flash",
  "Flex",
  "Trasdata",
  "New Genius",
  "Magic Motorsport",
  "BitBox",
  "PCMFlash",
  "MPPS",
  "Galletto",
];

// Keep in sync with the FAQPage JSON-LD in index.html — Google only honors
// FAQ structured data when the same questions are visible on the page.
const faqs = [
  {
    q: "What is a Stage 1 remap?",
    a: "A Stage 1 remap is an optimized ECU calibration for a completely stock vehicle. It safely raises boost pressure, fueling and ignition timing within factory hardware limits, typically gaining 15–30% more power and torque with no mechanical changes.",
  },
  {
    q: "What is the difference between Stage 1 and Stage 2 tuning?",
    a: "Stage 1 is calibrated for a stock car. Stage 2 requires supporting hardware upgrades such as a decat or downpipe exhaust, upgraded intake or intercooler, and delivers up to 45% more power. Stage 3 is a full custom calibration for heavily modified engines.",
  },
  {
    q: "How fast will I receive my tuning file?",
    a: "Most files are delivered in under 15 minutes during working hours (Mon–Sat, 9:00–22:00 CET). Complex custom calibrations can take longer.",
  },
  {
    q: "Which flashing tools do you support?",
    a: "We support all major master and slave tools including KESS, KTAG, Autotuner, CMD Flash, Flex, Trasdata, Dimsport New Genius, Magic Motorsport, BitBox, PCMFlash, MPPS and Galletto.",
  },
  {
    q: "Can you remove DPF, EGR or AdBlue?",
    a: "Yes — we provide DPF off, EGR off, AdBlue/SCR off, lambda off, swirl flap and many other emission-system solutions. These files are intended strictly for off-road, motorsport and export use.",
  },
  {
    q: "Do you also tune automatic gearboxes (TCU)?",
    a: "Yes, we tune TCU files for DSG, ZF and other automatic transmissions: faster shifts, raised torque limiters, launch control and more.",
  },
  {
    q: "How does pricing work?",
    a: "ChipTuneFiles uses a simple credit system: buy credits once and pay per file. There is no subscription and credits never expire. Master and slave tool users get their own price list.",
  },
  {
    q: "What if the file doesn't work on my car?",
    a: "Every job includes free revisions — describe the issue and we adjust the calibration until it runs right. If we can't deliver a working solution, the job is refunded to your credit balance.",
  },
];

const navLinks = [
  ["#services", "Services"],
  ["#process", "Process"],
  ["#calculator", "Calculator"],
  ["#faq", "FAQ"],
  ["#contact", "Contact"],
] as const;

// ─── Small pieces ───

/** The logo file is a wide image with a lot of black padding; crop to the mark. */
const Logo: React.FC<{ className?: string }> = ({ className = "" }) => (
  <span
    className={`relative block overflow-hidden ${className}`}
    style={{ width: 168, height: 36 }}
  >
    <img
      src="/logo.png"
      alt="ChipTuneFiles"
      className="absolute max-w-none mix-blend-lighten"
      style={{ width: 250, height: 167, left: -36, top: -59 }}
    />
  </span>
);

const SectionHeading: React.FC<{
  eyebrow: string;
  title: string;
  lead?: string;
  center?: boolean;
}> = ({ eyebrow, title, lead, center }) => (
  <div className={`mb-12 ${center ? "text-center mx-auto" : ""} max-w-2xl`}>
    <p className="text-xs font-semibold tracking-[0.14em] uppercase text-red-700 mb-3">
      {eyebrow}
    </p>
    <h2 className="text-3xl sm:text-[2.1rem] font-semibold tracking-tight text-slate-900 leading-tight">
      {title}
    </h2>
    {lead && <p className="mt-4 text-slate-600 leading-relaxed">{lead}</p>}
  </div>
);

// ─── Component ───

export const LandingPage: React.FC = () => {
  const [mobileNav, setMobileNav] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="bg-white text-slate-900 min-h-screen antialiased">
      {/* ═══ HEADER ═══ */}
      <header
        role="banner"
        className={`fixed top-0 inset-x-0 z-50 bg-slate-950 transition-shadow ${
          scrolled ? "shadow-lg shadow-black/20" : ""
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 flex items-center justify-between h-16">
          <a href="#top" aria-label="ChipTuneFiles home">
            <Logo />
          </a>

          <nav
            className="hidden md:flex items-center gap-7 text-[13px] font-medium text-slate-300"
            aria-label="Main navigation"
          >
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="hover:text-white transition-colors">
                {label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Link
              to="/login"
              className="text-[13px] font-medium text-slate-300 hover:text-white transition-colors px-4 py-2"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="text-[13px] font-semibold bg-white text-slate-900 hover:bg-slate-100 px-4 py-2 rounded-md transition-colors"
            >
              Open an account
            </Link>
          </div>

          <button
            onClick={() => setMobileNav(!mobileNav)}
            className="md:hidden p-2 text-slate-300"
            aria-label="Toggle menu"
          >
            {mobileNav ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileNav && (
          <div className="md:hidden bg-slate-950 border-t border-white/10 px-5 py-5 space-y-1">
            {navLinks.map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileNav(false)}
                className="block py-2.5 text-slate-200"
              >
                {label}
              </a>
            ))}
            <div className="pt-4 mt-3 border-t border-white/10 grid grid-cols-2 gap-3">
              <Link
                to="/login"
                className="text-center py-2.5 text-sm font-medium border border-white/20 rounded-md text-slate-200"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="text-center py-2.5 text-sm font-semibold bg-white rounded-md text-slate-900"
              >
                Open an account
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══ HERO ═══ */}
      <section
        id="top"
        className="relative pt-16 bg-slate-950 text-white overflow-hidden"
        aria-label="Introduction"
      >
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(to bottom, black, transparent 85%)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent 85%)",
          }}
          aria-hidden="true"
        />
        <div className="relative max-w-6xl mx-auto px-5 py-20 lg:py-28 grid lg:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 border border-white/15 rounded-full px-3 py-1 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              B2B file service for workshops and tuners
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold leading-[1.1] tracking-tight mb-6">
              ECU and TCU calibration files, engineered by hand.
            </h1>
            <p className="text-slate-300 text-lg leading-relaxed mb-9 max-w-xl">
              Upload the original read from your tool, choose the work you need,
              and receive a tested modified file through a secure portal —
              usually in under 15 minutes during working hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/register"
                className="group inline-flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-md transition-colors"
              >
                Open an account
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center border border-white/20 hover:border-white/40 text-white font-medium px-6 py-3 rounded-md transition-colors"
              >
                Sign in to the file portal
              </Link>
            </div>
          </div>

          {/* Facts panel */}
          <dl className="grid grid-cols-2 border border-white/10 rounded-lg overflow-hidden bg-white/[0.03]">
            {[
              ["10,000+", "Files delivered"],
              ["< 15 min", "Average turnaround in working hours"],
              ["Dyno-tested", "Files tested on the dyno before delivery"],
              ["Free revisions", "Included with every job"],
              ["Pay per file", "Prepaid credits that never expire"],
              ["Mon–Sat", "09:00–22:00 CET support"],
            ].map(([k, v], i) => (
              <div
                key={k}
                className={`p-6 ${i % 2 === 0 ? "border-r border-white/10" : ""} ${
                  i < 4 ? "border-b border-white/10" : ""
                }`}
              >
                <dt className="text-xl font-semibold tracking-tight">{k}</dt>
                <dd className="mt-1 text-sm text-slate-400 leading-snug">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Tools strip */}
        <div className="relative border-t border-white/10">
          <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col md:flex-row md:items-center gap-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 shrink-0">
              Compatible tools
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-300">
              {tools.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ═══ SERVICES ═══ */}
      <section id="services" className="py-24 scroll-mt-16" aria-label="Services">
        <div className="max-w-6xl mx-auto px-5">
          <SectionHeading
            eyebrow="Services"
            title="A complete calibration service for your workshop"
            lead="Every file is prepared by an engineer for the specific vehicle, ECU and software version you send — no generic or automatically patched files."
          />

          <div className="grid lg:grid-cols-3 gap-6">
            {serviceGroups.map((g) => (
              <article
                key={g.title}
                className="border border-slate-200 rounded-lg p-6 bg-white"
              >
                <h3 className="font-semibold text-slate-900 pb-4 mb-4 border-b border-slate-200">
                  {g.title}
                </h3>
                <ul className="space-y-4">
                  {g.items.map(([name, desc]) => (
                    <li key={name}>
                      <p className="text-sm font-medium text-slate-900">{name}</p>
                      <p className="text-sm text-slate-600 leading-relaxed mt-0.5">
                        {desc}
                      </p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500 mr-1">Also available:</span>
            {extraServices.map((s) => (
              <span
                key={s}
                className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded"
              >
                {s}
              </span>
            ))}
          </div>

          <p className="mt-8 text-xs text-slate-500 max-w-3xl leading-relaxed">
            Emission-related modifications are supplied strictly for off-road,
            motorsport and export use. The customer is responsible for complying
            with the regulations that apply in their country.
          </p>
        </div>
      </section>

      {/* ═══ PROCESS ═══ */}
      <section
        id="process"
        className="py-24 bg-slate-50 border-y border-slate-200 scroll-mt-16"
        aria-label="How it works"
      >
        <div className="max-w-6xl mx-auto px-5">
          <SectionHeading
            eyebrow="Process"
            title="From original read to finished file"
            lead="All communication, files and invoices stay in one portal, with a full history for every vehicle."
          />

          <ol className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <FileUp className="w-5 h-5" />,
                title: "Submit the job",
                desc: "Enter the vehicle and ECU details, select the required options and upload the original file from your tool.",
              },
              {
                icon: <Wrench className="w-5 h-5" />,
                title: "Engineering",
                desc: "An engineer prepares the calibration and it is tested on the dyno before release. You can follow the status of the job live.",
              },
              {
                icon: <Download className="w-5 h-5" />,
                title: "Download and flash",
                desc: "You receive an email and push notification when the file is ready. Revisions can be requested from the same job.",
              },
            ].map((step, i) => (
              <li key={step.title} className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-5">
                  <span className="w-10 h-10 rounded-md bg-slate-900 text-white flex items-center justify-center">
                    {step.icon}
                  </span>
                  <span className="text-sm font-medium text-slate-400 tabular-nums">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══ WHY US ═══ */}
      <section className="py-24" aria-label="Why ChipTuneFiles">
        <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-[0.9fr_1.1fr] gap-14">
          <SectionHeading
            eyebrow="Why ChipTuneFiles"
            title="Built for professionals who need reliable files"
            lead="We work with independent garages, tuning shops and resellers. Our focus is on consistent quality, clear pricing and fast answers."
          />
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-10">
            {[
              {
                icon: <Users className="w-5 h-5" />,
                title: "Engineers, not scripts",
                desc: "Each file is handled by an experienced calibrator for the exact software on your vehicle.",
              },
              {
                icon: <Wallet className="w-5 h-5" />,
                title: "Transparent pricing",
                desc: "Fixed prices per service in euros, with separate price lists for master and slave tools.",
              },
              {
                icon: <RefreshCcw className="w-5 h-5" />,
                title: "Revisions included",
                desc: "If a file needs adjustment we revise it at no cost, or refund the job to your balance.",
              },
              {
                icon: <ShieldCheck className="w-5 h-5" />,
                title: "Secure file handling",
                desc: "Files are transferred and stored encrypted, and are only accessible to your account.",
              },
            ].map((f) => (
              <div key={f.title}>
                <span className="text-red-700">{f.icon}</span>
                <h3 className="mt-3 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CALCULATOR ═══ */}
      <section
        id="calculator"
        className="py-24 bg-slate-50 border-y border-slate-200 scroll-mt-16"
        aria-label="Performance calculator"
      >
        <div className="max-w-5xl mx-auto px-5">
          <SectionHeading
            eyebrow="Performance estimate"
            title="Expected gains for your vehicle"
            lead="Select a vehicle to see typical power and torque figures before and after calibration. Final results depend on the condition and specification of the car."
            center
          />
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <iframe
              srcDoc={calcIframe}
              className="w-full border-0"
              style={{ height: "600px" }}
              title="ECU Performance Calculator — Calculate power gains for your vehicle"
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="py-24 scroll-mt-16" aria-label="Frequently asked questions">
        <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-[0.8fr_1.2fr] gap-14">
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently asked questions"
            lead="Can't find what you are looking for? Contact us and we will reply during working hours."
          />
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {faqs.map((faq) => (
              <details key={faq.q} className="group">
                <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <h3 className="text-[15px] font-medium text-slate-900">{faq.q}</h3>
                  <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-5 -mt-1 text-sm text-slate-600 leading-relaxed pr-8">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <section
        id="contact"
        className="py-24 bg-slate-50 border-t border-slate-200 scroll-mt-16"
        aria-label="Contact"
      >
        <div className="max-w-6xl mx-auto px-5 grid lg:grid-cols-2 gap-14">
          <div>
            <SectionHeading
              eyebrow="Contact"
              title="Talk to our team"
              lead="Questions about a specific vehicle, reseller pricing or a custom project? Get in touch."
            />
            <dl className="space-y-6">
              <div className="flex gap-4">
                <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <dt className="text-sm text-slate-500">Email</dt>
                  <dd>
                    <a
                      href="mailto:kikzaperformance@gmail.com"
                      className="font-medium text-slate-900 hover:text-red-700"
                    >
                      kikzaperformance@gmail.com
                    </a>
                  </dd>
                </div>
              </div>
              <div className="flex gap-4">
                <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <dt className="text-sm text-slate-500">WhatsApp</dt>
                  <dd>
                    <a
                      href="https://wa.me/38344955389"
                      className="font-medium text-slate-900 hover:text-red-700"
                    >
                      +383 44 955 389
                    </a>
                  </dd>
                </div>
              </div>
              <div className="flex gap-4">
                <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <dt className="text-sm text-slate-500">Working hours (CET)</dt>
                  <dd className="font-medium text-slate-900">
                    Monday – Saturday, 09:00 – 22:00
                  </dd>
                  <dd className="text-sm text-slate-500">Sunday closed</dd>
                </div>
              </div>
            </dl>
          </div>

          <form
            className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-5 self-start"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.target as HTMLFormElement);
              const name = String(data.get("name") ?? "");
              const email = String(data.get("email") ?? "");
              const message = String(data.get("message") ?? "");
              const subject = encodeURIComponent(`Inquiry from ${name}`);
              const body = encodeURIComponent(`${message}\n\nFrom: ${name} (${email})`);
              window.location.href = `mailto:kikzaperformance@gmail.com?subject=${subject}&body=${body}`;
            }}
          >
            {[
              { id: "name", label: "Name", type: "text", placeholder: "Full name" },
              { id: "email", label: "Email", type: "email", placeholder: "name@company.com" },
            ].map((f) => (
              <div key={f.id}>
                <label htmlFor={f.id} className="block text-sm font-medium text-slate-700 mb-1.5">
                  {f.label}
                </label>
                <input
                  id={f.id}
                  name={f.id}
                  type={f.type}
                  required
                  placeholder={f.placeholder}
                  className="w-full border border-slate-300 rounded-md px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                />
              </div>
            ))}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={5}
                placeholder="Vehicle, ECU and what you need"
                className="w-full border border-slate-300 rounded-md px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none"
              />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-md transition-colors"
            >
              <Send className="w-4 h-4" />
              Send message
            </button>
          </form>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="bg-slate-950 text-white" aria-label="Get started">
        <div className="max-w-6xl mx-auto px-5 py-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Open a workshop account
            </h2>
            <p className="mt-2 text-slate-400 max-w-lg">
              Registration is free. No subscription — buy credits when you need
              them and pay per file.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link
              to="/register"
              className="group inline-flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 font-semibold px-6 py-3 rounded-md transition-colors"
            >
              Open an account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center border border-white/20 hover:border-white/40 font-medium px-6 py-3 rounded-md transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="bg-slate-950 text-slate-400 border-t border-white/10" role="contentinfo">
        <div className="max-w-6xl mx-auto px-5 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed max-w-sm">
              Professional ECU and TCU calibration file service for workshops,
              tuners and resellers worldwide.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
            <nav className="space-y-2.5 text-sm" aria-label="Footer navigation">
              {navLinks.map(([href, label]) => (
                <a key={href} href={href} className="block hover:text-white transition-colors">
                  {label}
                </a>
              ))}
            </nav>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
            <nav className="space-y-2.5 text-sm" aria-label="Legal">
              <Link to="/terms" className="block hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link to="/privacy" className="block hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/refund-policy" className="block hover:text-white transition-colors">
                Refund Policy
              </Link>
            </nav>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-5 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} chiptunefiles.com. All rights reserved.</p>
            <p>Automated emails from this platform are not monitored. Please do not reply to them.</p>
            <KikzaCredit variant="onDark" />
          </div>
        </div>
      </footer>
    </div>
  );
};
