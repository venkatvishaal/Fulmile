import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { BsCheckLg } from 'react-icons/bs';
import PayloadGauge from '../ui/PayloadGauge';
import StatusBadge from '../ui/StatusBadge';

// Live production trip example that walks through the gates TripPlanner enforces.
const GATES = [
  'Vehicle not In Shop',
  'Licence valid',
  'Not already On Trip',
  '1,250 ≤ 10,000 kg',
];

export const ROUTE_PATH = 'M24 132 C 90 132, 96 52, 170 60 S 250 120, 316 40';

const STOP = 0.62; // where the truck sits along the route

export function RouteLine({ className = '', live = true }) {
  const reduceMotion = useReducedMotion();
  const pathRef = useRef(null);
  const progress = useMotionValue(0);
  const pointAt = (p) => {
    const el = pathRef.current;
    return el ? el.getPointAtLength(el.getTotalLength() * p) : { x: 24, y: 132 };
  };
  const x = useTransform(progress, (p) => pointAt(p).x);
  const y = useTransform(progress, (p) => pointAt(p).y);

  useEffect(() => {
    if (!live) return undefined;
    if (reduceMotion) { progress.jump(STOP); return undefined; }
    const controls = animate(progress, STOP, { duration: 2.4, ease: 'easeInOut', delay: 0.6 });
    return () => controls.stop();
  }, [live, reduceMotion, progress]);
  return (
    <svg viewBox="0 0 340 170" className={className} aria-hidden="true">
      <defs>
        <pattern id="board-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgb(var(--paper) / 0.07)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="340" height="170" fill="url(#board-grid)" />
      <path ref={pathRef} d={ROUTE_PATH} fill="none" stroke="rgb(var(--paper) / 0.18)" strokeWidth="6" strokeLinecap="round" />
      <motion.path
        d={ROUTE_PATH}
        fill="none"
        stroke="rgb(var(--signal))"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.4, ease: 'easeInOut', delay: 0.6 }}
      />
      <circle cx="24" cy="132" r="5" fill="rgb(var(--paper))" />
      <circle cx="316" cy="40" r="5" fill="none" stroke="rgb(var(--paper))" strokeWidth="2" />
      {live && (
        <motion.g style={{ x, y }}>
          <circle r="12" fill="rgb(var(--signal) / 0.25)">
            {!reduceMotion && <animate attributeName="r" values="7;14;7" dur="2s" repeatCount="indefinite" />}
          </circle>
          <circle r="5" fill="rgb(var(--signal))" stroke="rgb(var(--ink))" strokeWidth="2" />
        </motion.g>
      )}
    </svg>
  );
}

// Instrument strip under the hero stage: waybill facts on the left, the gates it passed on the right.
export default function HeroBoard() {
  const reduceMotion = useReducedMotion();
  const [dispatched, setDispatched] = useState(!!reduceMotion);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const t = setTimeout(() => setDispatched(true), 2000);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  return (
    <figure className="grid overflow-hidden rounded-[10px] border border-ink/10 bg-surface sm:grid-cols-2" aria-label="Example trip moving through dispatch gates">
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <span className="eyebrow">Trip waybill · live corridor</span>
          <motion.span key={dispatched ? 'd' : 'n'} initial={reduceMotion ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
            <StatusBadge status={dispatched ? 'Dispatched' : 'Draft'} />
          </motion.span>
        </div>
        <dl className="grid flex-1 grid-cols-3 text-[13px]">
          {[
            ['Vehicle', 'KA-05-89 · 10t'],
            ['Driver', 'TVS · HMV'],
            ['Route', 'Chennai → Delhi'],
          ].map(([k, v], i) => (
            <div key={k} className={`px-4 py-3 ${i ? 'border-l border-line' : ''}`}>
              <dt className="eyebrow text-[10px]">{k}</dt>
              <dd className="num mt-1 font-medium leading-snug">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="border-t border-line px-4 py-3 sm:border-l sm:border-t-0">
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {GATES.map((g, i) => (
            <motion.li
              key={g}
              className="flex items-start gap-2 text-[12px] leading-snug"
              initial={reduceMotion ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.3, duration: 0.35 }}
            >
              <span className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-ok text-surface">
                <BsCheckLg aria-hidden="true" className="text-[10px]" />
              </span>
              {g}
            </motion.li>
          ))}
        </ul>
        <PayloadGauge value={1250} max={10000} />
      </div>
    </figure>
  );
}
