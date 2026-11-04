import React from 'react';
import { Link } from 'react-router-dom';

// Template text. Have someone qualified review it and fill in your details before real users sign up.
const COMPANY = 'Fulmile';
const CONTACT_EMAIL = 'privacy@fulmile.example';
const UPDATED = '21 October 2026';

function LegalLayout({ title, children }) {
  return (
    <article className="mx-auto max-w-prose px-4 py-12 text-[15px] leading-relaxed text-ink/80 sm:px-6 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 text-[32px] font-bold leading-tight text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {UPDATED}</p>
      {children}
      <p className="mt-10 text-sm"><Link to="/" className="font-semibold text-ink underline underline-offset-4">Back to {COMPANY}</Link></p>
    </article>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, phone (optional), role and a hashed password. We never store your password in plain text.</li>
        <li>Fleet data you enter: vehicles, drivers, trips, maintenance, fuel and expense records.</li>
        <li>Live location shared by drivers during an active trip, so shippers can track cargo.</li>
        <li>Usage analytics: anonymous page views through Vercel Web Analytics, which uses no cookies.</li>
        <li>Error reports: when something crashes, technical details are sent to Sentry so we can fix it. We turn off sending personal data to Sentry.</li>
      </ul>
      <h2>Why we use it</h2>
      <p>To run the service: sign you in, show your fleet data to the people in your organisation who are allowed to see it, and keep the service working.</p>
      <h2>Who we share it with</h2>
      <p>Only the processors that run the service: Neon (database), Render (API hosting), Vercel (website hosting and analytics) and Sentry (error tracking). We don't sell your data.</p>
      <h2>How long we keep it</h2>
      <p>Your account lives until you delete it. Encrypted database backups are kept for 30 days.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Delete your account at any time from <strong>Account → Delete my account</strong>.</li>
        <li>Ask for a copy or correction of your data by emailing <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</li>
      </ul>
      <h2>Contact</h2>
      <p>Questions about this policy: <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <h2>Using {COMPANY}</h2>
      <p>By creating an account you agree to these terms. You must give accurate information and keep your password private. You're responsible for what happens under your account.</p>
      <h2>Your data</h2>
      <p>You own the fleet data you put in. You give us permission to store and process it only to run the service for you. Our <Link to="/privacy" className="underline">Privacy Policy</Link> explains how.</p>
      <h2>Acceptable use</h2>
      <ul>
        <li>Don't try to access accounts or data that aren't yours.</li>
        <li>Don't overload, probe or disrupt the service. We rate-limit requests.</li>
        <li>Don't use the service for anything illegal.</li>
      </ul>
      <h2>Availability</h2>
      <p>We work to keep {COMPANY} running but provide it "as is", without guarantees of uptime or fitness for a particular purpose. Route, cost and safety figures are aids to your judgement, not a replacement for it.</p>
      <h2>Ending your account</h2>
      <p>You can delete your account at any time. We may suspend accounts that break these terms.</p>
      <h2>Changes</h2>
      <p>If we change these terms we'll update the date above. Continuing to use the service means you accept the new terms.</p>
      <h2>Contact</h2>
      <p><a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
    </LegalLayout>
  );
}
