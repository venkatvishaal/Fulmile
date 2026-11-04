// Ported from Cult UI "direction-aware-tabs" (cult-ui.com/r/direction-aware-tabs.json).
// Changes: tablist/tab ARIA + arrow keys, per-instance layoutId, reduced motion, controlled `value`,
// ResizeObserver hook instead of react-use-measure, restyled to the Fulmile tokens.
import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';

function useMeasureHeight() {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, height];
}

export function DirectionAwareTabs({ tabs, value, onChange, label, className = '' }) {
  const [direction, setDirection] = useState(0);
  const [ref, height] = useMeasureHeight();
  const reduceMotion = useReducedMotion();
  const uid = useId();
  const tabRefs = useRef([]);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === value));

  const select = (index) => {
    if (index === activeIndex) return;
    setDirection(index > activeIndex ? 1 : -1);
    onChange(tabs[index].id);
    tabRefs.current[index]?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); select((activeIndex + 1) % tabs.length); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); select((activeIndex - 1 + tabs.length) % tabs.length); }
  };

  const shift = reduceMotion ? 0 : 48;
  const variants = {
    initial: (d) => ({ x: shift * d, opacity: 0 }),
    active: { x: 0, opacity: 1 },
    exit: (d) => ({ x: -shift * d, opacity: 0 }),
  };
  const active = tabs[activeIndex];

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="inline-flex gap-1 rounded border border-line bg-surface p-1">
        {tabs.map((tab, i) => {
          const selected = i === activeIndex;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              id={`${uid}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${uid}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(i)}
              className={`relative flex items-center gap-2 rounded-sm px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${selected ? 'text-paper' : 'text-muted hover:text-ink'}`}
            >
              {selected && (
                <motion.span
                  layoutId={`${uid}-bubble`}
                  className="absolute inset-0 rounded-sm bg-ink"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0.19, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <MotionConfig transition={reduceMotion ? { duration: 0 } : { duration: 0.35, type: 'spring', bounce: 0.15 }}>
        <motion.div className="relative mt-5 overflow-hidden" initial={false} animate={{ height: height || 'auto' }}>
          <div ref={ref}>
            <AnimatePresence custom={direction} mode="popLayout" initial={false}>
              <motion.div
                key={active.id}
                id={`${uid}-panel`}
                role="tabpanel"
                aria-labelledby={`${uid}-tab-${active.id}`}
                variants={variants}
                initial="initial"
                animate="active"
                exit="exit"
                custom={direction}
              >
                {active.content}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </MotionConfig>
    </div>
  );
}
