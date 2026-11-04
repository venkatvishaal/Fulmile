import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../ui/Modal';

// One-time welcome per user per browser. Steps point only at pages the role can open (see App.js allowedRoles).
const STEPS = {
  fleet_manager: [
    ['Add your vehicles', 'Register each vehicle with its capacity and cost.', '/vehicles'],
    ['Add your drivers', 'Record licence details so only eligible drivers get dispatched.', '/drivers'],
    ['Plan your first trip', 'Pick a vehicle and driver, then dispatch and track it live.', '/trips'],
  ],
  driver: [
    ['See your trips', 'Dispatch, share live location and complete your assigned trips.', '/trips'],
    ['Log fuel and expenses', 'Add receipts while on the road so costs stay accurate.', '/fuel-logs'],
    ['Check the dashboard', 'Fleet status at a glance.', '/dashboard'],
  ],
  safety_officer: [
    ['Review drivers', 'Watch licence expiry dates and safety scores.', '/drivers'],
    ['Check the dashboard', 'See which vehicles and drivers are active.', '/dashboard'],
    ['Find shared shipments', 'Look up capacity on routes already running.', '/shared-search'],
  ],
  financial_analyst: [
    ['Open reports', 'Cost per km, fuel efficiency and ROI by vehicle.', '/reports'],
    ['Review fuel and expenses', 'Every logged cost, filterable and exportable.', '/fuel-logs'],
    ['Check the dashboard', 'Live fleet KPIs.', '/dashboard'],
  ],
};

const storageKey = (userId) => `onboarded:${userId}`;

export default function Onboarding({ user }) {
  const [open, setOpen] = useState(() => !!user?.id && !localStorage.getItem(storageKey(user.id)));
  const [step, setStep] = useState(0);
  const steps = STEPS[user?.role] || STEPS.fleet_manager;

  const finish = () => {
    localStorage.setItem(storageKey(user.id), '1');
    setOpen(false);
  };

  if (!open) return null;
  const [title, body, to] = steps[step];
  const last = step === steps.length - 1;

  return (
    <Modal isOpen onClose={finish} title={`Welcome to Fulmile, ${user.name?.split(' ')[0] || 'there'}`} description={`Step ${step + 1} of ${steps.length}`}>
      <ol className="mb-5 flex gap-1.5" aria-hidden="true">
        {steps.map((s, i) => <li key={s[0]} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-ink' : 'bg-line'}`} />)}
      </ol>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <Link to={to} onClick={finish} className="mt-3 inline-block text-sm font-semibold text-ink underline underline-offset-4">Go there now</Link>
      <div className="mt-6 flex justify-between gap-2">
        <button type="button" className="btn btn-ghost" onClick={finish}>Skip</button>
        <div className="flex gap-2">
          {step > 0 && <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
          <button type="button" className="btn btn-primary" onClick={last ? finish : () => setStep(step + 1)}>{last ? 'Get started' : 'Next'}</button>
        </div>
      </div>
    </Modal>
  );
}
