import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Link } from 'react-router-dom';
import {
  BsArrowRight, BsArrowUpRight, BsList, BsX, BsGeoAlt, BsBroadcast, BsPinMap, BsLink45Deg, BsBoxSeam,
} from 'react-icons/bs';
import { Logo } from '../components/layout/AppShell';
import HeroBoard, { RouteLine } from '../components/landing/HeroBoard';
import Reveal from '../components/landing/Reveal';
import { hasWebGL } from '../components/landing/webgl';
import Tilt from '../components/landing/Tilt';
import CargoContainer3D, { Cuboid } from '../components/landing/CargoContainer3D';
import StatusBadge from '../components/ui/StatusBadge';
import { DirectionAwareTabs } from '../components/ui/DirectionAwareTabs';

// three.js ships in its own chunk; the SVG route panel covers loading and no-WebGL browsers.
const YardScene = lazy(() => import('../components/landing/YardScene'));
const CargoMapScene = lazy(() => import('../components/landing/CargoMapScene'));

function useMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

const REPO_URL = 'https://github.com/venkatvishaal/TransitOps';
const WRAP = 'mx-auto w-full max-w-wide px-5 sm:px-8 lg:px-12';
const TILE = 'relative h-full overflow-hidden rounded-[10px]';
const LEAD = 'text-[17px] leading-[1.55]';

const ANCHORS = [
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#roles', label: 'Roles' },
];

/* ── Shared pieces ──────────────────────────────────────── */

function PillCta({ to, children, tone = 'ink', className = '' }) {
  const tones = {
    ink: 'bg-ink text-paper',
    paper: 'bg-paper text-ink',
    signal: 'bg-signal text-ink',
  };
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 text-[14px] font-semibold transition-transform duration-300 hover:-translate-y-0.5 ${tones[tone]} ${className}`}
    >
      {children}
      <span className="grid h-9 w-9 place-items-center rounded-full bg-signal text-ink transition-transform duration-300 group-hover:-rotate-45">
        <BsArrowRight aria-hidden="true" />
      </span>
    </Link>
  );
}

// Section opener: statement on the left, supporting copy pinned to its last baseline on the right.
function Statement({ index, label, title, aside, inverted = false, asideClassName = '' }) {
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
      <Reveal className="lg:col-span-8">
        <p className={`hud flex items-center gap-3 ${inverted ? 'text-paper/50' : 'text-muted'}`}>
          <span className={inverted ? 'text-signal' : 'text-ink'}>{index}</span>
          <span aria-hidden="true" className={`h-px w-10 ${inverted ? 'bg-paper/25' : 'bg-ink/20'}`} />
          {label}
        </p>
        <h2 className={`display-lg mt-6 ${inverted ? 'text-paper' : 'text-ink'}`}>{title}</h2>
      </Reveal>
      {aside && (
        <Reveal delay={0.08} as="p" className={`${LEAD} max-w-[38ch] lg:col-span-4 lg:pb-2 ${inverted ? 'text-paper/65' : 'text-ink/65'} ${asideClassName}`}>
          {aside}
        </Reveal>
      )}
    </div>
  );
}

/* ── Navigation: floating pill that tightens on scroll ──── */

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = () => drawerRef.current?.close();

  return (
    <header className="fixed inset-x-0 top-3 z-40 px-3 sm:top-4 sm:px-5">
      <div
        className={`mx-auto flex items-center justify-between rounded-full border py-1.5 pl-4 pr-1.5 transition-[max-width,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] sm:pl-5 ${
          scrolled
            ? 'max-w-[960px] border-ink/10 bg-paper/85 shadow-[0_12px_40px_-18px_rgb(var(--ink)/0.35)] backdrop-blur-md'
            : 'max-w-[1336px] border-transparent bg-transparent'
        }`}
      >
        <Link to="/" aria-label="TransitOps home" className="shrink-0"><Logo /></Link>
        <nav aria-label="Sections" className="hidden items-center text-[13px] font-medium md:flex">
          {ANCHORS.map((a) => (
            <a key={a.href} href={a.href} className="rounded-full px-3.5 py-2 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink">{a.label}</a>
          ))}
        </nav>
        <div className="hidden items-center gap-1 md:flex">
          <Link to="/book-freight" className="rounded-full px-3 py-2 text-[13px] font-medium text-ink/70 transition-colors hover:text-ink">Book freight</Link>
          <Link to="/track" className="rounded-full px-3 py-2 text-[13px] font-medium text-ink/70 transition-colors hover:text-ink">Track cargo</Link>
          <Link to="/login" className="rounded-full px-3.5 py-2 text-[13px] font-medium text-ink/60 transition-colors hover:text-ink">Sign in</Link>
          <Link to="/register" className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-paper transition-colors hover:bg-ink/85">Get started</Link>
        </div>
        <button type="button" onClick={() => drawerRef.current?.showModal()} className="grid h-10 w-10 place-items-center rounded-full bg-ink text-paper md:hidden" aria-label="Open menu">
          <BsList className="text-lg" aria-hidden="true" />
        </button>
      </div>

      <dialog
        ref={drawerRef}
        aria-label="Menu"
        onClick={(e) => { if (e.target === drawerRef.current) close(); }}
        className="m-0 h-[100dvh] max-h-none w-[min(340px,88vw)] bg-transparent p-0 md:hidden"
      >
        <div className="flex h-full flex-col bg-ink px-6 py-5 text-paper">
          <div className="flex items-center justify-between">
            <Logo inverted />
            <button type="button" onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-paper/10" aria-label="Close menu"><BsX className="text-xl" aria-hidden="true" /></button>
          </div>
          <nav aria-label="Sections" className="mt-12 flex flex-col">
            {ANCHORS.map((a, i) => (
              <a key={a.href} href={a.href} onClick={close} className="flex items-baseline gap-4 border-b border-paper/10 py-4">
                <span className="hud text-signal">0{i + 1}</span>
                <span className="display-md text-paper">{a.label}</span>
              </a>
            ))}
          </nav>
          <div className="mt-auto grid gap-2">
            <Link to="/register" className="rounded-full bg-signal py-3.5 text-center text-sm font-semibold text-ink">Get started</Link>
            <Link to="/book-freight" className="rounded-full border border-paper/20 py-3.5 text-center text-sm font-semibold">Book freight</Link>
            <Link to="/track" className="rounded-full border border-paper/20 py-3.5 text-center text-sm font-semibold">Track cargo</Link>
            <Link to="/login" className="rounded-full border border-paper/20 py-3.5 text-center text-sm font-semibold">Sign in</Link>
          </div>
        </div>
      </dialog>
    </header>
  );
}

/* ── Hero: full-bleed 3D yard with a HUD on top ─────────── */

function SceneFallback() {
  return (
    <div className="absolute inset-0 bg-ink">
      <RouteLine className="h-full w-full" />
    </div>
  );
}

function Stage({ heroRef, progress, offset, className }) {
  const reduceMotion = useReducedMotion();
  const [webgl] = useState(hasWebGL);
  return (
    <div className={className}>
      {webgl ? (
        <Suspense fallback={<SceneFallback />}>
          <YardScene progress={progress} reduceMotion={!!reduceMotion} eventSource={heroRef} offset={offset} className="absolute inset-0" />
        </Suspense>
      ) : <SceneFallback />}
    </div>
  );
}

const HEADLINE = ['Dispatch only', 'what’s road‑ready.', 'Monetize every kilo.'];

function Hero() {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const desktop = useMedia('(min-width: 1024px)');
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  return (
    <section ref={ref} className="relative isolate overflow-hidden">
      {desktop && (
        <>
          <Stage heroRef={ref} progress={scrollYProgress} offset={[0.24, 0.06]} className="absolute inset-0 -z-10" />
          {/* Paper wash: the content column always sits on clean paper, never on the yard. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-[52%] bg-gradient-to-r from-paper from-55% to-transparent" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-paper to-transparent" />
          <span className="hud pointer-events-none absolute right-[max(3vw,24px)] top-24 flex items-center gap-2 rounded-full border border-ink/10 bg-paper/80 px-3 py-1.5 text-ink/60 backdrop-blur-sm">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-signal" />Live Corridor · Chennai → Delhi · KA-05-89
          </span>
        </>
      )}

      <div className={`${WRAP} flex flex-col pb-12 pt-24 sm:pt-28 lg:min-h-[max(760px,100svh)] lg:pb-14`}>
        <p className="hud flex items-center gap-2.5 text-muted">
          <span aria-hidden="true" className="h-2 w-2 rounded-[2px] bg-signal" />Smart Transport Operations &amp; Shared Freight Corridor Platform
        </p>

        <div className="mt-8 w-full lg:mt-auto lg:max-w-[530px]">
          <h1 className="display-hero text-ink">
            {HEADLINE.map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.05em]">
                <motion.span
                  className={`block whitespace-nowrap ${i === 2 ? 'relative w-fit' : ''}`}
                  initial={reduceMotion ? false : { y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.15 + i * 0.09, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  {line}
                  {i === 2 && (
                    <svg aria-hidden="true" viewBox="0 0 600 24" preserveAspectRatio="none" className="absolute -bottom-[0.04em] left-0 h-[0.14em] w-full">
                      <motion.path
                        d="M4 15 C 140 4, 320 22, 596 7"
                        fill="none"
                        stroke="rgb(var(--signal))"
                        strokeWidth="4"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                        initial={reduceMotion ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.1, delay: 0.9, ease: 'easeInOut' }}
                      />
                    </svg>
                  )}
                </motion.span>
              </span>
            ))}
          </h1>

          {!desktop && <Stage heroRef={ref} progress={scrollYProgress} offset={[0, 0]} className="relative -mx-5 mt-8 h-[52svh] min-h-[320px] sm:-mx-8" />}

          <Reveal delay={0.35}>
            <p className="mt-7 max-w-[40ch] text-[15.5px] leading-[1.6] text-ink/70">
              One unified platform for fleet carriers and freight shippers. Triple-lock compliance prevents unsafe runs before they leave the yard, zero-login GPS tracks cargo live, and the Single Dispatch Rule merges shared corridor loads at 100% net margin.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <PillCta to="/register">Set up your fleet</PillCta>
              <Link to="/book-freight" className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-4 py-3 text-[14px] font-semibold text-ink transition-colors hover:border-ink">
                <BsBoxSeam aria-hidden="true" /> Book freight
              </Link>
              <Link to="/track" className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-4 py-3 text-[14px] font-semibold text-ink transition-colors hover:border-ink">
                <BsGeoAlt aria-hidden="true" /> Track cargo
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.5} className="mt-8"><HeroBoard /></Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Rule marquee ───────────────────────────────────────── */

const RULES = [
  'No expired licences',
  'Corridor cargo sharing @ 100% net margin',
  'No double bookings',
  'No payload overloads',
  'Shop-locked vehicle safety',
  'Zero-login public GPS telemetry',
  'Instant trip financial settlement',
  'Individual & Corporate B2B GST freight',
];

function Marquee() {
  const row = (hidden) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {RULES.map((r) => (
        <li key={r} className="flex items-center">
          <span className="display-md whitespace-nowrap uppercase text-paper">{r}</span>
          <span aria-hidden="true" className="mx-8 h-2.5 w-2.5 rounded-full bg-signal sm:mx-12" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Dispatch rules" className="overflow-hidden border-y border-ink bg-ink py-6 sm:py-8">
      <div className="marquee flex w-max">{row(false)}{row(true)}</div>
    </section>
  );
}

/* ── Problem → rule ledger ──────────────────────────────── */

const LEDGER = [
  ['“Where is my cargo right now?”', 'Drivers stream continuous HTML5 GPS coordinates via WebSockets; shippers follow a zero-login public tracking link on OpenStreetMap with live speed, heading, and geocoded checkpoints.'],
  ['Empty miles & wasted payload capacity', 'Remaining tonnage is automatically calculated per dispatched trip and surfaced to shippers. The Single Dispatch Rule merges shared cargo en-route at 100% net margin pure profit.'],
  ['Unsafe dispatches & roadside detentions', 'Expired commercial licences, suspended drivers, vehicles In Shop or Retired, double bookings, and tonnage overloads are strictly refused by automated pre-dispatch gating.'],
  ['Financial blindspots & manual freight billing', 'Automated Completed Trip Financial Settlement immediately reconciles primary quotes, shared cargo revenue, and fuel receipts into clear net operating profit and margin %.'],
];

function Ledger() {
  return (
    <section className="section-y">
      <div className={WRAP}>
        <Statement
          index="01"
          label="Problem → solution"
          title="Four structural failures. Four automated rules."
          aside="Instead of trusting people to remember manual policy, TransitOps builds operational compliance and financial reconciliation directly into the dispatch engine."
        />
        <div className="mt-[clamp(56px,7vw,112px)] border-b border-ink/15">
          {LEDGER.map(([problem, rule], i) => (
            <Reveal key={problem} delay={i * 0.05} className="group relative grid gap-4 border-t border-ink/15 py-8 lg:grid-cols-12 lg:items-baseline lg:gap-8 lg:py-11">
              <span aria-hidden="true" className="absolute inset-x-0 -top-px h-[2px] origin-left scale-x-0 bg-signal transition-transform duration-700 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-x-100" />
              <span className="display-lg numeral-outline transition-[-webkit-text-stroke-color] duration-500 group-hover:[-webkit-text-stroke-color:rgb(var(--ink))] lg:col-span-2">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="display-md text-ink lg:col-span-5">{problem}</h3>
              <p className={`${LEAD} max-w-[44ch] text-ink/65 lg:col-span-5`}>{rule}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features bento ─────────────────────────────────────── */

function TileHead({ label, title, inverted = false }) {
  return (
    <div>
      <p className={`hud ${inverted ? 'text-paper/45' : 'text-muted'}`}>{label}</p>
      <h3 className={`display-md mt-4 max-w-[18ch] ${inverted ? 'text-paper' : 'text-ink'}`}>{title}</h3>
    </div>
  );
}

// Live cargo tracking map: the camera follows the shipment, click the map to drop a checkpoint, Go live pauses it.
function TrackingStage({ live, onCheckpoints, count }) {
  const reduceMotion = useReducedMotion();
  const [webgl] = useState(hasWebGL);
  const touch = useMedia('(pointer: coarse)');
  return (
    <div className="relative my-8 h-[300px] cursor-crosshair overflow-hidden rounded-[10px] border border-paper/10 lg:h-[400px]">
      {webgl ? (
        <Suspense fallback={<RouteLine className="absolute inset-0 h-full w-full" />}>
          <CargoMapScene live={live} onCheckpoints={onCheckpoints} reduceMotion={!!reduceMotion} className="absolute inset-0" />
        </Suspense>
      ) : <RouteLine className="absolute inset-0 h-full w-full" />}
      {webgl && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
          <span className="hud truncate rounded-full border border-paper/10 bg-ink/75 px-3 py-1.5 text-paper/70 backdrop-blur-sm">
            {touch ? 'Tap the map to pin' : 'Drag to orbit · click the map to pin'}
          </span>
          <span className="hud shrink-0 rounded-full border border-paper/10 bg-ink/75 px-3 py-1.5 text-paper/70 backdrop-blur-sm" aria-live="polite">
            {count}/6 checkpoints
          </span>
        </div>
      )}
    </div>
  );
}

function TrackingTile() {
  const [live, setLive] = useState(true);
  const [count, setCount] = useState(0);
  const points = [
    [BsBroadcast, 'Live WebSocket Stream', 'Drivers broadcast HTML5 geolocation coordinates directly to the tracking room with sub-second latency.'],
    [BsPinMap, 'Geocoded Checkpoints', 'Log waypoints with reverse-geocoded place names and timestamps even when cellular data fluctuates.'],
    [BsLink45Deg, 'Zero-Login Public URL', 'Customers track shipments at /track with a unique shipment tracking code — zero credentials or app needed.'],
  ];
  return (
    <div className={`${TILE} spotlight-dark flex min-h-[600px] flex-col bg-ink p-8 text-paper lg:p-12`}>
      <div className="flex items-start justify-between gap-6">
        <TileHead label="Real-time GPS tracking" title="The shipper watches cargo move in real time." inverted />
        <button
          type="button"
          aria-pressed={live}
          onClick={() => setLive((v) => !v)}
          className={`hud flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 transition-colors ${live ? 'border-signal/60 bg-signal/10 text-paper' : 'border-paper/15 text-paper/60 hover:text-paper'}`}
        >
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-signal' : 'bg-paper/40'}`} />
          {live ? 'Live · streaming' : 'Go live'}
        </button>
      </div>
      <TrackingStage live={live} onCheckpoints={setCount} count={count} />
      <ul className="grid gap-6 border-t border-paper/10 pt-8 sm:grid-cols-3">
        {points.map(([Icon, t, d]) => (
          <li key={t}>
            <Icon aria-hidden="true" className="text-lg text-signal" />
            <p className="mt-3 text-[15px] font-semibold">{t}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-paper/60">{d}</p>
          </li>
        ))}
      </ul>
      <Link to="/track" className="hud mt-8 inline-flex w-fit items-center gap-2 text-paper/80 transition-colors hover:text-signal">
        Open the tracking portal <BsArrowUpRight aria-hidden="true" />
      </Link>
    </div>
  );
}

function CapacityTile() {
  return (
    <div className={`${TILE} spotlight flex flex-col border border-ink/10 bg-surface p-8 lg:p-10`}>
      <TileHead label="Corridor consolidation" title="Turn empty payload capacity into 100% net margin." />
      <p className="mt-4 text-[15px] leading-relaxed text-ink/65">
        Dispatched trucks publish unutilized tonnage along active routes (e.g. Chennai → Delhi). The Single Dispatch Rule merges shared cargo onto existing trips with ₹0 extra fuel cost, delivering pure profit.
      </p>
      <div className="mt-auto pt-8">
        <CargoContainer3D />
        <p className="hud text-muted">Example · 10,000 kg truck · 1,000 kg base · 250 kg shared · 8,750 kg open</p>
      </div>
    </div>
  );
}

function GatingTile() {
  const gates = [
    ['Vehicle road readiness', 'Retired and In Shop vehicles never appear in the active dispatch pool.'],
    ['Driver license compliance', 'Expired commercial licences, pending renewals, and suspended drivers cannot be assigned.'],
    ['Single-active assignment', 'Vehicles and drivers already On Trip are locked from duplicate dispatches.'],
    ['Payload tonnage ceiling', 'Base freight plus combined shared bookings are checked strictly against certified max load.'],
  ];
  return (
    <div className={`${TILE} spotlight border border-ink/10 bg-surface p-8 lg:p-10`}>
      <TileHead label="Pre-dispatch compliance gating" title="Unsafe trips don’t get a dispatch button." />
      <ol className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {gates.map(([t, d], i) => (
          <li key={t} className="border-t border-ink/10 pt-4">
            <span className="hud text-ink">G{i + 1}</span>
            <p className="mt-2 text-[15px] font-semibold text-ink">{t}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-ink/60">{d}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MaintenanceTile() {
  return (
    <div className={`${TILE} spotlight flex flex-col border border-ink/10 bg-paper p-8 lg:p-10`}>
      <TileHead label="Maintenance lifecycle" title="Open a repair log, the truck leaves the yard pool." />
      <div className="mt-auto pt-10" aria-label="Available changes to In Shop when a log opens, and back when it closes">
        <div className="flex items-center justify-between"><StatusBadge status="Available" /><StatusBadge status="In Shop" /></div>
        <div className="hud mt-4 grid gap-2 text-muted">
          <span className="flex items-center gap-2"><span className="h-px flex-1 bg-ink/40" />service opened →</span>
          <span className="flex items-center gap-2">← work order certified<span className="h-px flex-1 bg-ink/40" /></span>
        </div>
      </div>
    </div>
  );
}

function AnalyticsTile() {
  const formulas = [
    ['Gross Revenue', 'primary quote + shared cargo revenue'],
    ['Net Operating Profit', 'gross revenue − total fuel expense'],
    ['Net Profit Margin', '(net profit ÷ gross revenue) × 100'],
    ['Corridor Fuel Efficiency', 'total km ÷ litres consumed'],
  ];
  return (
    <div className={`${TILE} spotlight-dark flex flex-col bg-ink p-8 text-paper lg:p-10`}>
      <TileHead label="Financial intelligence" title="Instant settlement ledger on trip completion." inverted />
      <dl className="mt-auto divide-y divide-paper/10 pt-8">
        {formulas.map(([k, v]) => (
          <div key={k} className="py-3.5">
            <dt className="text-[14px] font-semibold">{k}</dt>
            <dd className="num mt-1 text-[13px] text-signal">= {v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="section-y pt-0">
      <div className={WRAP}>
        <Statement
          index="02"
          label="Features"
          title="Engineered for carriers, built for shippers."
          aside="Five integrated modules share a single real-time ledger, uniting fleet operations, corridor load consolidation, and automated financial settlements."
        />
        <div className="mt-[clamp(56px,7vw,112px)] grid gap-4 lg:grid-cols-12">
          <Reveal className="lg:col-span-8 lg:row-span-2"><TrackingTile /></Reveal>
          <Reveal delay={0.06} className="lg:col-span-4 lg:row-span-2"><Tilt max={4} className="h-full"><CapacityTile /></Tilt></Reveal>
          <Reveal className="lg:col-span-5"><Tilt max={3} className="h-full"><GatingTile /></Tilt></Reveal>
          <Reveal delay={0.06} className="lg:col-span-3"><Tilt max={5} className="h-full"><MaintenanceTile /></Tilt></Reveal>
          <Reveal delay={0.12} className="lg:col-span-4"><Tilt max={4} className="h-full"><AnalyticsTile /></Tilt></Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── How it works: sticky 3D conveyor ───────────────────── */

const STEPS = [
  ['Onboard or join carrier', 'Fleet operators register a company or join an existing carrier via directory; shippers onboard as Individual or Corporate B2B with GST.', 'Available'],
  ['Book & match corridors', 'Shippers request cargo movement; the platform matches active corridors and offers remaining vehicle capacity at optimized rates.', 'Draft'],
  ['Pre-flight gated dispatch', 'Triple-lock validation confirms valid driver licenses, roadworthy vehicles, and payload limits before dispatch.', 'Dispatched'],
  ['Live telemetry & shared load', 'Driver broadcasts real-time GPS telemetry; secondary shared cargo merges directly into the active corridor run at 100% margin.', 'On Trip'],
  ['Completed trip settlement', 'Trip completion records final odometer, logs fuel expense receipts, and delivers instant net profit margin reconciliation.', 'Completed'],
];
const FLOOR_TILT = 58;

const truckFace = (tone) => () => (tone === 'cab' ? 'bg-ink border border-paper/25' : tone === 'spare' ? 'bg-signal/80 border border-signal' : 'bg-paper border border-ink/20');

function ConveyorTruck({ status }) {
  return (
    <div className="absolute left-0 top-1/2" style={{ transformStyle: 'preserve-3d', transform: 'scale3d(1.6, 1.6, 1.6)' }}>
      {/* Lengths run along x, height along z (out of the tilted floor). */}
      <Cuboid w={92} h={42} d={46} face={truckFace('trailer')} style={{ x: -26, z: 24 }} />
      <Cuboid w={44} h={42} d={46} face={truckFace('spare')} style={{ x: 44, z: 24 }} />
      <Cuboid w={34} h={42} d={40} face={truckFace('cab')} style={{ x: 86, z: 21 }} />
      <div className="absolute left-0 top-0" style={{ transform: `translate3d(-50%, -50%, 120px) rotateX(-${FLOOR_TILT}deg)` }}>
        <span className="block -translate-x-1/2"><StatusBadge status={status} /></span>
      </div>
    </div>
  );
}

function Conveyor() {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const track = useTransform(scrollYProgress, [0.06, 0.9], [0, 1], { clamp: true });
  const left = useTransform(track, (v) => `${10 + v * 80}%`);
  const fill = useTransform(track, (v) => `${10 + v * 80}%`);
  useMotionValueEvent(track, 'change', (v) => setActive(Math.round(v * 4)));

  return (
    <section id="how" ref={ref} className="relative h-[300vh] bg-ink text-paper">
      <div className="sticky top-0 flex h-screen flex-col overflow-hidden pb-[5vh] pt-[max(96px,12vh)]">
        <div className={WRAP}>
          <Statement
            index="03"
            label="How it works"
            title="A corridor run, from booking to financial settlement."
            aside="Every status change is driven by the trip lifecycle, ensuring the dispatch board and settlement ledger are always in sync."
            asideClassName="[@media(max-height:820px)]:hidden"
            inverted
          />
        </div>
        <div className={`${WRAP} mt-auto`}>
          <div className="relative h-[clamp(180px,26vh,320px)] [perspective:1300px]" aria-hidden="true">
            <div className="absolute inset-x-0 bottom-0 h-[300px]" style={{ transform: `rotateX(${FLOOR_TILT}deg)`, transformOrigin: '50% 100%', transformStyle: 'preserve-3d' }}>
              <div className="absolute inset-x-0 top-1/2 h-[120px] -translate-y-1/2 border-y border-paper/15 bg-paper/[0.04]">
                <motion.div style={{ width: fill }} className="absolute inset-y-0 left-0 bg-signal/15" />
                <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgb(var(--signal))_0_18px,transparent_18px_36px)] opacity-70" />
              </div>
              {STEPS.map((s, i) => (
                <span
                  key={s[0]}
                  className={`absolute top-1/2 h-[160px] w-px -translate-y-1/2 transition-colors duration-300 ${i <= active ? 'bg-signal' : 'bg-paper/20'}`}
                  style={{ left: `${10 + i * 20}%` }}
                />
              ))}
              <motion.div className="absolute inset-y-0" style={{ left, transformStyle: 'preserve-3d' }}>
                <ConveyorTruck status={STEPS[active][2]} />
              </motion.div>
            </div>
          </div>
          <ol className="mt-[clamp(16px,3vh,32px)] grid grid-cols-5 gap-6">
            {STEPS.map(([t, d], i) => (
              <li key={t} className={`transition-opacity duration-500 ${i <= active ? 'opacity-100' : 'opacity-35'}`}>
                <span className={`hud ${i === active ? 'text-signal' : 'text-paper/50'}`}>{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-[22px] font-bold leading-tight [font-stretch:75%]">{t}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-paper/60">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function StepList() {
  return (
    <section id="how" className="section-y bg-ink text-paper">
      <div className={WRAP}>
        <Statement
          index="03"
          label="How it works"
          title="A corridor run, from booking to financial settlement."
          aside="Every status change is driven by the trip lifecycle, ensuring the dispatch board and settlement ledger are always in sync."
          inverted
        />
        <ol className="mt-14 border-b border-paper/10">
          {STEPS.map(([t, d, status], i) => (
            <Reveal as="li" key={t} delay={i * 0.05} className="grid grid-cols-[48px_1fr] gap-4 border-t border-paper/10 py-7">
              <span className="hud pt-1 text-signal">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 className="display-md text-paper">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-paper/60">{d}</p>
                <div className="mt-3"><StatusBadge status={status} /></div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function HowItWorks() {
  const desktop = useMedia('(min-width: 1024px)');
  const reduceMotion = useReducedMotion();
  return desktop && !reduceMotion ? <Conveyor /> : <StepList />;
}

/* ── Roles ──────────────────────────────────────────────── */

// Mirrors the allowedRoles on each <PrivateRoute> in App.js.
const ROLES = [
  {
    id: 'fleet_manager',
    label: 'Fleet Manager',
    lead: 'Directs dispatch operations, corridor capacity, and vehicle readiness.',
    does: [
      'Onboards vehicles and assigns verified drivers',
      'Dispatches trips and enforces compliance gates',
      'Accepts and consolidates shared cargo requests',
      'Oversees fleet health and maintenance logs',
    ],
    areas: ['Dashboard', 'Trips', 'Freight requests', 'Vehicles', 'Drivers', 'Maintenance', 'Fuel & expenses', 'Reports'],
  },
  {
    id: 'driver',
    label: 'Commercial Driver',
    lead: 'Navigates the freight corridor and reports live from the cab.',
    does: [
      'Accepts and executes assigned trip waybills',
      'Broadcasts live HTML5 GPS location coordinates',
      'Logs fuel purchases with pump receipts and odometer',
      'Delivers primary and consolidated shared cargo',
    ],
    areas: ['Dashboard', 'Trips', 'Fuel & expenses', 'Live Telemetry'],
  },
  {
    id: 'safety_officer',
    label: 'Safety Officer',
    lead: 'Guarantees compliance standards and vehicle fitness.',
    does: [
      'Audits commercial driver licenses & expiries',
      'Validates fitness certificates and road permits',
      'Enforces vehicle preventative maintenance schedules',
      'Monitors safety performance scores and logs',
    ],
    areas: ['Dashboard', 'Drivers', 'Vehicles', 'Maintenance'],
  },
  {
    id: 'financial_analyst',
    label: 'Financial Analyst',
    lead: 'Audits freight reconciliations, fuel costs, and corridor ROI.',
    does: [
      'Audits completed trip financial settlements',
      'Verifies 100% shared cargo net margin economics',
      'Tracks fleet fuel efficiency (KM/L) and costs',
      'Exports multi-sheet reports to Excel and PDF',
    ],
    areas: ['Dashboard', 'Fuel & expenses', 'Reports'],
  },
  {
    id: 'shipper',
    label: 'Freight Shipper',
    lead: 'Books corridor freight and tracks shipments with zero login.',
    does: [
      'Books Individual or Corporate B2B freight with GST',
      'Discovers open shared capacity along major corridors',
      'Tracks live cargo movement on OpenStreetMap',
      'Receives automated delivery waybills and proof of delivery',
    ],
    areas: ['Book freight', 'My bookings', 'Track cargo (Public)'],
  },
];

function RolePanel({ role }) {
  return (
    <div className={`${TILE} spotlight grid gap-10 border border-ink/10 bg-surface p-8 sm:p-12 md:grid-cols-12`}>
      <div className="md:col-span-5">
        <p className="hud text-muted">Role</p>
        <h3 className="display-lg mt-4 text-ink">{role.label}</h3>
        <p className={`${LEAD} mt-4 text-ink/65`}>{role.lead}</p>
        <PillCta to={role.id === 'shipper' ? '/book-freight' : '/register'} className="mt-8">
          {role.id === 'shipper' ? 'Book freight cargo' : 'Create an account'}
        </PillCta>
      </div>
      <div className="md:col-span-4">
        <p className="hud text-muted">Core Responsibilities</p>
        <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10 text-[16px] text-ink">
          {role.does.map((d) => <li key={d} className="py-3">{d}</li>)}
        </ul>
      </div>
      <div className="md:col-span-3">
        <p className="hud text-muted">Accessible Portal Areas</p>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {role.areas.map((a) => <li key={a} className="rounded-full border border-ink/15 px-3 py-1.5 font-mono text-[11px] text-ink">{a}</li>)}
        </ul>
      </div>
    </div>
  );
}

function Roles() {
  const [active, setActive] = useState(ROLES[0].id);
  return (
    <section id="roles" className="section-y">
      <div className={WRAP}>
        <Statement
          index="04"
          label="Role-based access"
          title="Every role gets exactly the screens it needs."
          aside="Access is strictly enforced with JWT claims on the API gateway and role-guarded routing in the client application."
        />
        <Reveal className="mt-[clamp(48px,6vw,96px)]">
          <div className="-mx-5 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
            <DirectionAwareTabs
              label="Roles"
              value={active}
              onChange={setActive}
              tabs={ROLES.map((r) => ({ id: r.id, label: <span className="whitespace-nowrap">{r.label}</span>, content: <Tilt max={2}><RolePanel role={r} /></Tilt> }))}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── CTA band + footer ──────────────────────────────────── */

function FinalCta() {
  return (
    <section className="section-y bg-signal text-ink">
      <div className={`${WRAP} grid gap-12 lg:grid-cols-12 lg:items-end`}>
        <Reveal className="lg:col-span-8">
          <p className="hud flex items-center gap-3 text-ink/60">
            <span className="text-ink">05</span><span aria-hidden="true" className="h-px w-10 bg-ink/30" />Next step
          </p>
          <h2 className="display-xl mt-6">Put your fleet on the board.<br />Or book freight today.</h2>
        </Reveal>
        <Reveal delay={0.1} className="flex items-end gap-6 lg:col-span-4 lg:flex-col lg:items-start">
          <Link
            to="/register"
            aria-label="Create an account"
            className="group grid aspect-square w-[clamp(112px,11vw,168px)] place-items-center rounded-full bg-ink text-paper transition-transform duration-500 hover:scale-105 focus-visible:outline-ink"
          >
            <BsArrowRight aria-hidden="true" className="text-[clamp(28px,2.6vw,40px)] transition-transform duration-500 group-hover:-rotate-45" />
          </Link>
          <div>
            <p className="text-[17px] font-semibold">Join as Carrier or Shipper</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
              <Link to="/login" className="hud text-ink/75 underline decoration-ink/30 underline-offset-4 hover:text-ink">
                Sign in to fleet
              </Link>
              <Link to="/book-freight" className="hud text-ink/75 underline decoration-ink/30 underline-offset-4 hover:text-ink">
                Book freight cargo
              </Link>
              <Link to="/track" className="hud text-ink/75 underline decoration-ink/30 underline-offset-4 hover:text-ink">
                Public tracker
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    ['Product', ANCHORS.map((a) => [a.label, a.href, 'anchor'])],
    ['Shippers', [['Book freight', '/book-freight'], ['Track cargo', '/track'], ['My bookings', '/my-bookings']]],
    ['Carriers', [['Set up fleet', '/register'], ['Operations portal', '/login'], ['Fleet directory', '/register']]],
    ['Legal', [['Privacy policy', '/privacy'], ['Terms of service', '/terms'], ['GitHub repo', REPO_URL, 'external']]],
  ];
  const linkCls = 'text-paper/70 transition-colors hover:text-paper';
  return (
    <footer className="overflow-hidden bg-ink text-paper">
      <div className={`${WRAP} grid gap-12 pb-10 pt-20 md:grid-cols-12`}>
        <div className="md:col-span-4">
          <Logo inverted />
          <p className="mt-4 max-w-[32ch] text-[15px] leading-relaxed text-paper/55">
            Smart transport operations and freight logistics platform. Unifying carriers and shippers with real-time GPS tracking, automated compliance, and 100% margin corridor load sharing.
          </p>
        </div>
        {cols.map(([title, links]) => (
          <nav key={title} aria-label={title} className="md:col-span-2">
            <p className="hud text-paper/40">{title}</p>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              {links.map(([label, href, kind]) => (
                <li key={label}>
                  {kind === 'anchor' && <a href={href} className={linkCls}>{label}</a>}
                  {kind === 'external' && <a href={href} target="_blank" rel="noreferrer" className={linkCls}>{label}</a>}
                  {!kind && <Link to={href} className={linkCls}>{label}</Link>}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p aria-hidden="true" className="display-xl pointer-events-none -mb-[0.16em] select-none whitespace-nowrap px-3 text-center text-[19.5vw] text-paper/[0.06]">
        TransitOps
      </p>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="grain min-h-screen overflow-x-clip bg-paper">
      <a href="#top" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-signal focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <LandingNav />
      <main id="top">
        <Hero />
        <Marquee />
        <Ledger />
        <Features />
        <HowItWorks />
        <Roles />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
