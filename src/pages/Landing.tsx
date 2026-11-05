import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Plus, Menu, X, Play, Pause } from "lucide-react";
import { KikzaCredit } from "@/components/KikzaCredit";
import type { CarFeature } from "@/components/landing/CarScene";

// three.js is heavy; only load it when the landing page renders the car.
const CarScene = lazy(() => import("@/components/landing/CarScene"));

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
      BackgroundColor: "#111111",
      BoxColor: "#1a1a1a",
      FontColor: "#f2efe9",
      ButtonColor: "#d7261e",
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

const carFeatures: {
  key: CarFeature;
  name: string;
  group: "Performance" | "Emissions & sound";
  gain?: string;
  desc: string;
}[] = [
  {
    key: "stage1",
    name: "Stage 1",
    group: "Performance",
    gain: "+15–30%",
    desc: "Software only, for a stock car. Boost, fuelling, timing and torque limiters are recalibrated in the ECU — no hardware changes needed.",
  },
  {
    key: "stage2",
    name: "Stage 2",
    group: "Performance",
    gain: "up to +45%",
    desc: "For cars with supporting hardware — downpipe, intercooler or intake. The file is calibrated around the parts you have fitted.",
  },
  {
    key: "stage3",
    name: "Stage 3",
    group: "Performance",
    gain: "Custom",
    desc: "Bigger turbo, upgraded fuelling or a built engine. A full custom calibration for your exact build — send us the hardware list with the file.",
  },
  {
    key: "dpf",
    name: "DPF off",
    group: "Emissions & sound",
    desc: "A blocked particulate filter means forced regenerations, high back-pressure and limp mode. We take the DPF out of the calibration — regen strategy, pressure sensor monitoring and the related fault codes.",
  },
  {
    key: "adblue",
    name: "AdBlue / SCR off",
    group: "Emissions & sound",
    desc: "No more dosing faults, failed NOx sensors or the “no start in 500 km” countdown. The SCR system, tank heater and dosing logic are disabled cleanly.",
  },
  {
    key: "egr",
    name: "EGR off",
    group: "Emissions & sound",
    desc: "Stops sooty exhaust gas being fed back into the intake. The valve is closed in software and its monitoring removed, so no warning lights after a blank or delete.",
  },
  {
    key: "pops",
    name: "Pops & Bangs",
    group: "Emissions & sound",
    desc: "Crackles and bangs when you lift off the throttle. Tell us how loud you want it — from a light burble to aggressive — and in which RPM range.",
  },
  {
    key: "popcorn",
    name: "Popcorn / Hardcut",
    group: "Emissions & sound",
    desc: "A rapid-fire rev limiter. Hold the car on the limiter and it machine-guns through the exhaust. Usually combined with launch control.",
  },
];

const carLabels = Object.fromEntries(carFeatures.map((f) => [f.key, f.name])) as Record<
  CarFeature,
  string
>;

const serviceTable: { group: string; rows: [string, string, string][] }[] = [
  {
    group: "Performance",
    rows: [
      ["ST1", "Stage 1", "Stock hardware. Typically 15–30% more power and torque."],
      ["ST2", "Stage 2", "Downpipe, intake or intercooler upgrades. Up to 45%."],
      ["ST3", "Stage 3", "Full custom calibration for built engines."],
      ["TCU", "Gearbox (TCU)", "DSG, ZF and other automatics — shift speed, torque limits, launch."],
    ],
  },
  {
    group: "Emissions",
    rows: [
      ["DPF", "DPF / GPF / OPF off", "Filter removed from the calibration, no regenerations."],
      ["EGR", "EGR off", "Valve closed, monitoring removed."],
      ["SCR", "AdBlue / SCR off", "Dosing, heater and NOx monitoring disabled."],
      ["O2", "Lambda / Decat", "Rear O2 and catalyst efficiency monitoring off."],
    ],
  },
  {
    group: "Extras",
    rows: [
      ["P&B", "Pops & Bangs", "Overrun crackle, intensity on request."],
      ["HC", "Popcorn / Hardcut", "Rapid rev-limiter cut."],
      ["VMX", "Speed limiter off", "Factory Vmax removed or changed."],
      ["SS", "Start-Stop off", "Disabled permanently."],
    ],
  },
];

const extraServices = [
  "Swirl flaps off",
  "Hot start fix",
  "Launch control",
  "Intake flaps off",
  "EVAP off",
  "Torque monitoring off",
  "TVA off",
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
  ["#under-the-car", "Explore the car"],
  ["#services", "Services"],
  ["#calculator", "Calculator"],
  ["#faq", "FAQ"],
  ["#contact", "Contact"],
] as const;

// ─── Small pieces ───

const condensed = { fontStretch: "72%" } as React.CSSProperties;

/** The logo file is a wide image with a lot of black padding; crop to the mark. */
const Logo: React.FC = () => (
  <span className="relative block overflow-hidden" style={{ width: 168, height: 36 }}>
    <img
      src="/logo.png"
      alt="ChipTuneFiles"
      className="absolute max-w-none mix-blend-lighten"
      style={{ width: 250, height: 167, left: -36, top: -59 }}
    />
  </span>
);

const Tag: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <p
    className={`font-tech text-[11px] uppercase tracking-[0.18em] mb-5 ${
      dark ? "text-[#f2efe9]/50" : "text-black/50"
    }`}
  >
    {children}
  </p>
);

// ─── Component ───

// Pexels clips (free license): a McLaren-led supercar convoy, then an Aston
// Martin convoy. Set mirror: true on a clip whose cars sit under the headline.
const HERO_CLIPS = [
  { src: "/videos/hero-mclaren.mp4", mirror: false },
  { src: "/videos/hero-convoy.mp4", mirror: false },
];

export const LandingPage: React.FC = () => {
  const [mobileNav, setMobileNav] = useState(false);
  const [feature, setFeature] = useState<CarFeature | null>(null);
  // Hero clips play back to back and crossfade into each other.
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [clip, setClip] = useState(0);
  const [videoPaused, setVideoPaused] = useState(false);

  const nextClip = (i: number) => {
    const n = (i + 1) % HERO_CLIPS.length;
    const v = videoRefs.current[n];
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    }
    setClip(n);
  };

  const toggleVideo = () => {
    const v = videoRefs.current[clip];
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => {});
      setVideoPaused(false);
    } else {
      v.pause();
      setVideoPaused(true);
    }
  };

  useEffect(() => {
    document.body.style.backgroundColor = "#111111";
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, []);

  const activeFeature = carFeatures.find((f) => f.key === feature);

  return (
    <div className="bg-[#111111] text-[#f2efe9] min-h-screen antialiased selection:bg-[#d7261e] selection:text-white">
      {/* ═══ HEADER ═══ */}
      <header role="banner" className="sticky top-0 z-50 bg-[#111111]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-[1200px] mx-auto px-5 flex items-center justify-between h-16">
          <a href="#top" aria-label="ChipTuneFiles home">
            <Logo />
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-[13px] text-white/60" aria-label="Main navigation">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="hover:text-white transition-colors">
                {label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-5">
            <Link to="/login" className="text-[13px] text-white/80 hover:text-white">
              File Portal Login
            </Link>
            <Link
              to="/register"
              className="text-[13px] font-semibold bg-[#d7261e] hover:bg-[#ef3a2f] text-white px-4 py-2 transition-colors"
            >
              Register
            </Link>
          </div>

          <button
            onClick={() => setMobileNav(!mobileNav)}
            className="lg:hidden p-2 -mr-2 text-white/80"
            aria-label="Toggle menu"
          >
            {mobileNav ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileNav && (
          <div className="lg:hidden border-t border-white/10 px-5 py-4">
            {navLinks.map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMobileNav(false)}
                className="block py-3 border-b border-white/5 text-white/80"
              >
                {label}
              </a>
            ))}
            <div className="pt-4 grid grid-cols-2 gap-3">
              <Link to="/login" className="text-center py-3 text-sm border border-white/20">
                File Portal Login
              </Link>
              <Link to="/register" className="text-center py-3 text-sm font-semibold bg-[#d7261e] text-white">
                Register
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══ HERO: full-size daytime video ═══ */}
      <section id="top" aria-label="Introduction" className="bg-[#f2efe9] text-black">
        <div className="relative overflow-hidden min-h-[600px] h-[calc(100svh-4rem-7.5rem)] max-h-[860px] flex items-center">
          {HERO_CLIPS.map(({ src, mirror }, i) => (
            <video
              key={src}
              ref={(el) => {
                videoRefs.current[i] = el;
              }}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                clip === i ? "opacity-100" : "opacity-0"
              } ${mirror ? "-scale-x-100" : ""}`}
              src={src}
              autoPlay={i === 0}
              muted
              playsInline
              preload="auto"
              aria-hidden="true"
              onEnded={() => nextClip(i)}
            />
          ))}
          {/* Light wash on the left keeps the black headline readable over daylight footage. */}
          <div className="absolute inset-0 bg-[#f2efe9]/70 lg:bg-transparent lg:bg-gradient-to-r lg:from-[#f2efe9] lg:via-[#f2efe9]/85 lg:to-[#f2efe9]/0" />

          <button
            onClick={toggleVideo}
            aria-label={videoPaused ? "Play background video" : "Pause background video"}
            className="absolute right-4 top-4 sm:right-6 sm:top-6 z-10 w-9 h-9 flex items-center justify-center border border-white/40 bg-black/35 text-white/85 hover:text-white hover:border-white transition-colors"
          >
            {videoPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <div className="relative w-full max-w-[1200px] mx-auto px-5 py-12">
            <div className="max-w-[40rem]">
              <Tag>ECU &amp; TCU file service for workshops and tuners</Tag>
              <h1
                className="font-display font-extrabold uppercase leading-[0.9] tracking-[-0.005em] text-[3rem] sm:text-[4.4rem] lg:text-[5.1rem]"
                style={condensed}
              >
                Precision ECU
                <br />
                &amp; TCU tuning,
                <br />
                <span className="text-[#d7261e]">written by calibrators.</span>
              </h1>
              <p className="mt-7 text-black/75 text-[17px] leading-relaxed max-w-[34rem]">
                Stage 1–3 remaps, DPF, EGR, AdBlue, pops &amp; bangs and gearbox
                files — written for your exact ECU, tested on the dyno, and
                delivered in under 15 minutes.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="group inline-flex items-center gap-4 bg-[#d7261e] hover:bg-[#b81f18] text-white text-[12px] font-semibold uppercase tracking-[0.2em] px-7 py-4 transition-colors"
                >
                  Register
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="group inline-flex items-center gap-4 border-2 border-black bg-[#f2efe9]/60 hover:bg-black hover:text-white text-black text-[12px] font-semibold uppercase tracking-[0.2em] px-7 py-[14px] transition-colors"
                >
                  File Portal Login
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Numbers */}
        <div className="bg-[#111111] text-[#f2efe9]">
          <dl className="max-w-[1200px] mx-auto grid grid-cols-2 lg:grid-cols-4">
            {[
              ["10,000+", "files delivered"],
              ["< 15 min", "average turnaround"],
              ["Dyno", "tested before delivery"],
              ["Mon–Sat", "09:00–22:00 CET"],
            ].map(([k, v], i) => (
              <div
                key={k}
                className={`px-5 py-7 ${i % 2 === 1 ? "border-l" : ""} ${
                  i > 1 ? "border-t lg:border-t-0" : ""
                } ${i === 2 ? "lg:border-l" : ""} border-white/10`}
              >
                <dt className="font-display font-bold text-3xl sm:text-4xl uppercase" style={condensed}>
                  {k}
                </dt>
                <dd className="mt-1 font-tech text-[11px] uppercase tracking-[0.14em] text-white/50">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ═══ 3D CAR ═══ */}
      <section aria-label="What we can change on the car" className="border-b border-white/10">
        <div className="max-w-[1200px] mx-auto px-5 pt-20 lg:pt-24">
          <div className="grid lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-7">
              <Tag dark>01 — Under the car</Tag>
              <h2
                className="font-display font-extrabold uppercase leading-[0.92] text-[2.6rem] sm:text-6xl"
                style={condensed}
              >
                Pick a system.
                <br />
                We'll show you where it lives.
              </h2>
            </div>
            <p className="lg:col-span-5 text-white/60 leading-relaxed">
              Tap any option. The camera moves to the parts it affects — drag
              the car to look around it.
            </p>
          </div>
        </div>

        {/* 3D car + picker */}
        <div id="under-the-car" className="scroll-mt-20 max-w-[1200px] mx-auto lg:px-5 mt-10 grid lg:grid-cols-12">
          <div className="lg:col-span-8 relative h-[340px] sm:h-[460px] lg:h-[580px] bg-[radial-gradient(ellipse_at_center,#222_0%,#111_70%)] lg:border lg:border-white/10">
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center font-tech text-xs uppercase tracking-widest text-white/40">
                  Loading car…
                </div>
              }
            >
              <CarScene active={feature} labels={carLabels} />
            </Suspense>
            {activeFeature?.gain && (
              <div className="pointer-events-none absolute left-4 top-4 sm:left-6 sm:top-6">
                <div className="font-tech text-[10px] uppercase tracking-widest text-white/50">
                  Typical gain
                </div>
                <div className="font-display font-extrabold uppercase text-4xl sm:text-5xl text-[#4ade80]" style={condensed}>
                  {activeFeature.gain}
                </div>
              </div>
            )}
            <div className="pointer-events-none absolute left-4 bottom-4 font-tech text-[10px] uppercase tracking-widest text-white/35">
              {feature ? "Showing: " + activeFeature?.name : "Drag to rotate · pick a system"}
            </div>
            {feature && (
              <button
                onClick={() => setFeature(null)}
                className="absolute right-4 top-4 font-tech text-[11px] uppercase tracking-wider border border-white/25 px-3 py-1.5 text-white/80 hover:bg-white hover:text-black transition-colors"
              >
                Reset view
              </button>
            )}
          </div>

          <div className="lg:col-span-4 lg:border-y lg:border-r border-white/10">
            {(["Performance", "Emissions & sound"] as const).map((group) => (
              <div key={group}>
                <h2 className="px-5 pt-4 pb-2 font-tech text-[10px] uppercase tracking-[0.18em] text-white/40 border-b border-white/10">
                  {group}
                </h2>
                <ul>
                  {carFeatures
                    .filter((f) => f.group === group)
                    .map((f) => {
                      const on = feature === f.key;
                      const n = carFeatures.indexOf(f) + 1;
                      return (
                        <li key={f.key} className="border-b border-white/10">
                          <button
                            onClick={() => setFeature(on ? null : f.key)}
                            aria-expanded={on}
                            className={`w-full text-left px-5 py-3 flex items-baseline gap-4 transition-colors ${
                              on ? "bg-[#d7261e] text-white" : "hover:bg-white/5"
                            }`}
                          >
                            <span className={`font-tech text-[11px] ${on ? "text-white/70" : "text-white/40"}`}>
                              0{n}
                            </span>
                            <span
                              className="font-display font-bold uppercase text-xl tracking-wide flex-1"
                              style={condensed}
                            >
                              {f.name}
                            </span>
                            <Plus className={`w-4 h-4 transition-transform ${on ? "rotate-45" : ""}`} />
                          </button>
                          {on && (
                            <p className="px-5 pb-4 pt-0.5 bg-[#d7261e] text-white/90 text-sm leading-relaxed">
                              {f.desc}
                            </p>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="max-w-[1200px] mx-auto px-5 pt-5 pb-8 font-tech text-[11px] leading-relaxed text-white/40">
          Emission-related modifications are supplied for off-road, motorsport and
          export use only. You are responsible for the rules that apply where the
          vehicle is used.
        </p>
      </section>

      {/* ═══ SERVICES (paper) ═══ */}
      <section id="services" className="scroll-mt-16 bg-[#f2efe9] text-black" aria-label="Services">
        <div className="max-w-[1200px] mx-auto px-5 py-20 lg:py-28">
          <div className="grid lg:grid-cols-12 gap-6 mb-14">
            <div className="lg:col-span-6">
              <Tag>02 — The menu</Tag>
              <h2
                className="font-display font-extrabold uppercase leading-[0.92] text-[2.6rem] sm:text-6xl"
                style={condensed}
              >
                Everything we do,
                <br />
                on one sheet.
              </h2>
            </div>
            <p className="lg:col-span-5 lg:col-start-8 self-end text-black/65 leading-relaxed">
              Combine as many options as you need on one job. Prices are fixed per
              service in euros, with separate lists for master and slave tools — you
              see the total before you upload.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-x-10 gap-y-12">
            {serviceTable.map((g) => (
              <div key={g.group}>
                <h3 className="font-tech text-[11px] uppercase tracking-[0.18em] pb-3 border-b-2 border-black">
                  {g.group}
                </h3>
                <table className="w-full">
                  <tbody>
                    {g.rows.map(([code, name, desc]) => (
                      <tr key={code} className="border-b border-black/15 align-top">
                        <td className="py-4 pr-3 w-12 font-tech text-[11px] text-black/45">{code}</td>
                        <td className="py-4">
                          <div className="font-semibold">{name}</div>
                          <div className="text-sm text-black/60 leading-snug mt-0.5">{desc}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <p className="mt-10 text-sm text-black/60 leading-relaxed">
            <span className="font-semibold text-black">Also on request:</span>{" "}
            {extraServices.join(" · ")}.
          </p>

          <div className="mt-14 pt-6 border-t border-black/15 flex flex-col md:flex-row md:items-baseline gap-3 md:gap-8">
            <span className="font-tech text-[11px] uppercase tracking-[0.18em] text-black/50 shrink-0">
              Works with
            </span>
            <p className="text-sm text-black/75">{tools.join(" / ")}</p>
          </div>
        </div>
      </section>

      {/* ═══ HOW A JOB GOES ═══ */}
      <section className="border-b border-white/10" aria-label="How a job works">
        <div className="max-w-[1200px] mx-auto px-5 py-20 lg:py-28">
          <div className="grid lg:grid-cols-12 gap-10 items-start mb-14">
            <div className="lg:col-span-7">
              <Tag dark>03 — How a job goes</Tag>
              <h2
                className="font-display font-extrabold uppercase leading-[0.92] text-[2.6rem] sm:text-6xl"
                style={condensed}
              >
                Fifteen minutes, give or take.
              </h2>
            </div>
          {/* Example job ticket */}
          <aside className="lg:col-span-5 lg:pl-6 max-w-md" aria-label="Example job">
            <div className="bg-[#f2efe9] text-black rotate-[1.2deg] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-dashed border-black/25 font-tech text-[11px] uppercase tracking-wider">
                <span>Job ticket</span>
                <span className="text-black/50">Example</span>
              </div>
              <dl className="px-5 py-4 font-tech text-[13px] leading-6">
                {[
                  ["Vehicle", "VW Golf 7 2.0 TDI 150"],
                  ["ECU", "Bosch EDC17C64"],
                  ["Tool", "KESS3 · slave"],
                  ["Requested", "Stage 1 + DPF + EGR"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-black/50">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="px-5 py-4 border-t border-dashed border-black/25 font-tech text-[13px] leading-6">
                <div className="flex justify-between">
                  <span className="text-black/50">Uploaded</span>
                  <span>14:02</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-black/50">File ready</span>
                  <span>14:13</span>
                </div>
              </div>
              <div className="px-5 py-3 bg-black text-[#f2efe9] flex items-center justify-between font-tech text-[11px] uppercase tracking-wider">
                <span>Dyno-tested · ready to flash</span>
                <span className="text-[#4ade80]">● Done</span>
              </div>
            </div>
          </aside>
          </div>

          <ol className="grid md:grid-cols-4 border-t border-white/15">
            {[
              ["00:00", "You upload", "Vehicle, ECU, tool and the original read. Pick the options and confirm the price."],
              ["00:02", "We check it", "A calibrator checks the read, the hardware and the software version before touching it."],
              ["00:10", "We write it", "The calibration is written for your car and tested on the dyno before it goes out."],
              ["~00:15", "You flash it", "Email and push notification when it's ready. Download it from the portal and flash."],
            ].map(([time, title, desc], i) => (
              <li
                key={time}
                className={`pt-6 pb-2 md:pr-6 ${i > 0 ? "md:pl-6 md:border-l border-white/15" : ""} border-b md:border-b-0 border-white/10 pb-8 md:pb-2`}
              >
                <div className="font-tech text-sm text-[#d7261e]">{time}</div>
                <h3 className="mt-3 font-display font-bold uppercase text-2xl" style={condensed}>
                  {title}
                </h3>
                <p className="mt-2 text-sm text-white/60 leading-relaxed">{desc}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-sm text-white/45">
            Not happy with how it drives? Open the job again and describe the
            problem — revisions are free.
          </p>
        </div>
      </section>

      {/* ═══ A NOTE FROM US ═══ */}
      <section className="border-b border-white/10" aria-label="About us">
        <div className="max-w-[1200px] mx-auto px-5 py-20 lg:py-28 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <Tag dark>04 — Who you're dealing with</Tag>
          </div>
          <div className="lg:col-span-8">
            <p className="font-display text-2xl sm:text-[2rem] leading-[1.3] text-white/90 font-medium">
              We're calibrators first. Every file that leaves here was written by
              one of us for your exact car, and it's been on the dyno before it
              reaches your laptop.
            </p>
            <p className="mt-6 text-white/60 leading-relaxed max-w-2xl">
              More than 10,000 files later, that hasn't changed. You pay per file
              with credits that never expire, revisions are always free, and if we
              can't make something work, the job goes back to your balance.
            </p>
            <p className="mt-8 font-tech text-xs uppercase tracking-[0.18em] text-white/50">
              — The ChipTuneFiles team
            </p>
          </div>
        </div>
      </section>

      {/* ═══ CALCULATOR ═══ */}
      <section id="calculator" className="scroll-mt-16 border-b border-white/10" aria-label="Performance calculator">
        <div className="max-w-[1200px] mx-auto px-5 py-20 lg:py-28">
          <div className="grid lg:grid-cols-12 gap-6 mb-10">
            <div className="lg:col-span-7">
              <Tag dark>05 — Before you buy</Tag>
              <h2
                className="font-display font-extrabold uppercase leading-[0.92] text-[2.6rem] sm:text-6xl"
                style={condensed}
              >
                What will your car make?
              </h2>
            </div>
            <p className="lg:col-span-5 self-end text-white/60 leading-relaxed">
              Pick the vehicle for typical figures before and after. Every car is a
              little different — condition and hardware matter.
            </p>
          </div>
          <div className="border border-white/10">
            <iframe
              srcDoc={calcIframe}
              className="w-full border-0 block"
              style={{ height: "600px" }}
              title="ECU Performance Calculator — Calculate power gains for your vehicle"
              sandbox="allow-scripts allow-same-origin"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ═══ FAQ (paper) ═══ */}
      <section id="faq" className="scroll-mt-16 bg-[#f2efe9] text-black" aria-label="Frequently asked questions">
        <div className="max-w-[1200px] mx-auto px-5 py-20 lg:py-28 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <Tag>06 — Questions</Tag>
            <h2
              className="font-display font-extrabold uppercase leading-[0.92] text-[2.6rem] sm:text-5xl"
              style={condensed}
            >
              Things people ask us.
            </h2>
            <p className="mt-5 text-black/60 text-sm leading-relaxed max-w-xs">
              Anything else — message us on WhatsApp during working hours.
            </p>
          </div>
          <div className="lg:col-span-8 border-t-2 border-black">
            {faqs.map((faq, i) => (
              <details key={faq.q} className="group border-b border-black/15">
                <summary className="flex items-start gap-5 py-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="font-tech text-[11px] text-black/40 pt-1 w-6">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="flex-1 font-semibold text-[17px]">{faq.q}</h3>
                  <Plus className="w-5 h-5 mt-0.5 shrink-0 transition-transform group-open:rotate-45" />
                </summary>
                <p className="pl-11 pr-8 pb-6 -mt-1 text-black/65 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <section id="contact" className="scroll-mt-16" aria-label="Contact">
        <div className="max-w-[1200px] mx-auto px-5 py-20 lg:py-28 grid lg:grid-cols-12 gap-14">
          <div className="lg:col-span-7">
            <Tag dark>07 — Talk to us</Tag>
            <h2
              className="font-display font-extrabold uppercase leading-[0.92] text-[2.6rem] sm:text-6xl mb-10"
              style={condensed}
            >
              Got a car on the bench?
            </h2>

            <div className="space-y-8">
              <a href="https://wa.me/38344955389" className="group block">
                <span className="font-tech text-[11px] uppercase tracking-[0.18em] text-white/45">WhatsApp</span>
                <span className="mt-1 flex items-center gap-3 font-display font-bold text-3xl sm:text-4xl group-hover:text-[#d7261e] transition-colors" style={condensed}>
                  +383 44 955 389
                  <ArrowUpRight className="w-6 h-6" />
                </span>
              </a>
              <a href="mailto:kikzaperformance@gmail.com" className="group block">
                <span className="font-tech text-[11px] uppercase tracking-[0.18em] text-white/45">Email</span>
                <span className="mt-1 flex items-center gap-3 font-display font-bold text-2xl sm:text-4xl break-all group-hover:text-[#d7261e] transition-colors" style={condensed}>
                  kikzaperformance@gmail.com
                </span>
              </a>
              <div>
                <span className="font-tech text-[11px] uppercase tracking-[0.18em] text-white/45">Hours (CET)</span>
                <p className="mt-1 text-white/80">Monday – Saturday, 09:00 – 22:00 · Sunday closed</p>
              </div>
            </div>
          </div>

          <form
            className="lg:col-span-5 space-y-6 self-end"
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
            <p className="text-white/60 text-sm">Or leave a message and we'll get back to you.</p>
            {[
              { id: "name", label: "Your name", type: "text" },
              { id: "email", label: "Email", type: "email" },
            ].map((f) => (
              <div key={f.id}>
                <label htmlFor={f.id} className="block font-tech text-[11px] uppercase tracking-[0.18em] text-white/45">
                  {f.label}
                </label>
                <input
                  id={f.id}
                  name={f.id}
                  type={f.type}
                  required
                  className="w-full bg-transparent border-0 border-b border-white/25 px-0 py-2.5 text-white focus:outline-none focus:border-[#d7261e] focus:ring-0"
                />
              </div>
            ))}
            <div>
              <label htmlFor="message" className="block font-tech text-[11px] uppercase tracking-[0.18em] text-white/45">
                Car, ECU and what you need
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={4}
                className="w-full bg-transparent border-0 border-b border-white/25 px-0 py-2.5 text-white focus:outline-none focus:border-[#d7261e] focus:ring-0 resize-none"
              />
            </div>
            <button
              type="submit"
              className="group inline-flex items-center gap-3 bg-[#d7261e] hover:bg-[#ef3a2f] text-white font-semibold px-6 py-3.5 transition-colors"
            >
              Send message
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>
      </section>

      {/* ═══ BIG CTA ═══ */}
      <section className="bg-[#d7261e] text-white" aria-label="Get started">
        <Link to="/register" className="group block max-w-[1200px] mx-auto px-5 py-14 lg:py-20">
          <span className="font-tech text-[11px] uppercase tracking-[0.18em] text-white/70">
            Free to register · no subscription
          </span>
          <span
            className="mt-3 flex items-center justify-between gap-6 font-display font-extrabold uppercase leading-[0.9] text-5xl sm:text-7xl lg:text-8xl"
            style={condensed}
          >
            Open an account
            <ArrowRight className="w-12 h-12 sm:w-20 sm:h-20 shrink-0 group-hover:translate-x-2 transition-transform" />
          </span>
        </Link>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="text-white/50" role="contentinfo">
        <div className="max-w-[1200px] mx-auto px-5 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed max-w-sm">
              ECU and TCU calibration files for workshops, tuners and resellers.
            </p>
            <Link to="/login" className="mt-5 inline-flex items-center gap-2 text-sm text-white hover:text-[#d7261e]">
              File Portal Login <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <nav className="space-y-2.5 text-sm" aria-label="Footer navigation">
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} className="block hover:text-white transition-colors">
                {label}
              </a>
            ))}
          </nav>
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
        <div className="border-t border-white/10">
          <div className="max-w-[1200px] mx-auto px-5 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/35">
            <p>© {new Date().getFullYear()} chiptunefiles.com</p>
            <p>Automated emails from this platform are not monitored. Please do not reply to them.</p>
            <KikzaCredit variant="onDark" />
          </div>
        </div>
      </footer>
    </div>
  );
};
