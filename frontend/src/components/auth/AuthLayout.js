import React, { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'motion/react';
import { BsArrowRight } from 'react-icons/bs';
import { Logo } from '../layout/AppShell';
import { RouteLine } from '../landing/HeroBoard';
import { hasWebGL } from '../landing/webgl';

// three.js stays in its own chunk; this page paints the form first.
const AuthScene = lazy(() => import('./AuthScene'));

const DOT = { idle: 'bg-paper/40', typing: 'bg-signal', busy: 'bg-ok', error: 'bg-danger', ready: 'bg-signal' };

export function SubmitPill({ loading, children, busyLabel }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="group inline-flex w-full items-center justify-between gap-3 rounded-full bg-ink py-1.5 pl-6 pr-1.5 text-[15px] font-semibold text-paper transition-[transform,opacity] duration-300 hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
    >
      {loading ? busyLabel : children}
      <span className="grid h-10 w-10 place-items-center rounded-full bg-signal text-ink transition-transform duration-300 group-hover:-rotate-45">
        <BsArrowRight aria-hidden="true" className={loading ? 'animate-pulse' : ''} />
      </span>
    </button>
  );
}

/**
 * Split "checkpoint" layout: form column (first in DOM, so it is first in tab order) and a framed 3D viewport.
 * scene: props for <AuthScene>; readout: { tone, text, meta } shown in the viewport's status bar.
 */
export default function AuthLayout({ checkpoint, title, lead, scene, readout, footer, children }) {
  const reduceMotion = useReducedMotion();
  const [webgl] = useState(hasWebGL);

  return (
    <div className="grain flex min-h-screen flex-col bg-paper lg:grid lg:grid-cols-12">
      <div className="flex flex-col px-5 pb-8 pt-5 sm:px-10 lg:order-2 lg:col-span-5 lg:min-h-screen lg:px-14 xl:px-20">
        <header className="flex items-center justify-between">
          <Link to="/" aria-label="Fulmile home"><Logo /></Link>
          <Link to="/track" className="hud text-ink/60 transition-colors hover:text-ink">Track cargo</Link>
        </header>

        <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10 lg:mx-0 lg:py-14">
          <p className="hud flex items-center gap-3 text-muted">
            <span className="text-ink">{checkpoint}</span>
            <span aria-hidden="true" className="h-px w-10 bg-ink/20" />
            Checkpoint
          </p>
          <h1 className="display-lg mt-5 text-ink">{title}</h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink/65">{lead}</p>
          <div className="mt-10">{children}</div>
        </main>

        <footer className="mx-auto w-full max-w-[440px] border-t border-ink/10 pt-5 text-[14px] text-ink/65 lg:mx-0">{footer}</footer>
      </div>

      <aside
        aria-label="Illustration"
        className="relative order-first m-3 h-[34svh] min-h-[240px] overflow-hidden rounded-[14px] bg-ink lg:sticky lg:top-3 lg:order-1 lg:col-span-7 lg:h-[calc(100svh-24px)]"
      >
        {webgl ? (
          <Suspense fallback={<RouteLine className="absolute inset-0 h-full w-full" />}>
            <AuthScene {...scene} reduceMotion={!!reduceMotion} className="absolute inset-0" />
          </Suspense>
        ) : <RouteLine className="absolute inset-0 h-full w-full" />}

        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3">
          <span className="hud rounded-full border border-paper/15 bg-ink/70 px-3 py-1.5 text-paper/75 backdrop-blur-sm">{scene.variant === 'gate' ? 'Sign-in gate' : 'Fleet bay'}</span>
          <span className="hud hidden rounded-full border border-paper/15 bg-ink/70 px-3 py-1.5 text-paper/50 backdrop-blur-sm sm:inline">Illustrative</span>
        </div>

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-4 rounded-[10px] border border-paper/10 bg-ink/80 px-4 py-3 backdrop-blur-sm">
          <span className="hud flex min-w-0 items-center gap-2.5 text-paper/85">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full transition-colors ${DOT[readout.tone] || DOT.idle} ${readout.tone === 'typing' || readout.tone === 'busy' ? 'animate-pulse' : ''}`} />
            <span className="truncate">{readout.text}</span>
          </span>
          {readout.meta && <span className="hud hidden shrink-0 text-paper/45 sm:inline">{readout.meta}</span>}
        </div>
      </aside>
    </div>
  );
}
