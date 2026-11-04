import React from 'react';

// Tone per status; the coloured left tick reads like a route-board marker.
const tones = {
  // Vehicle & Driver
  Available: 'ok',
  'On Trip': 'transit',
  'In Shop': 'warn',
  Retired: 'danger',
  Suspended: 'danger',
  'Off Duty': 'neutral',
  // Trip
  Draft: 'neutral',
  Dispatched: 'transit',
  Completed: 'ok',
  Cancelled: 'danger',
  // Maintenance log
  open: 'warn',
  closed: 'ok',
  // Freight bookings
  Pending: 'warn',
  Quoted: 'transit',
  Accepted: 'ok',
  'In Transit': 'transit',
  Delivered: 'ok',
};

const toneClass = {
  ok: 'text-ok before:bg-ok',
  transit: 'text-transit before:bg-transit',
  warn: 'text-warn before:bg-warn',
  danger: 'text-danger before:bg-danger',
  neutral: 'text-muted before:bg-muted',
};

export default function StatusBadge({ status, label }) {
  const tone = toneClass[tones[status] || 'neutral'];
  return (
    <span
      className={`relative inline-flex items-center whitespace-nowrap rounded-sm border border-line bg-surface py-0.5 pl-3 pr-2 font-mono text-[11px] font-medium uppercase tracking-[0.06em] before:absolute before:inset-y-1 before:left-1 before:w-[3px] before:rounded-full ${tone}`}
    >
      {label || status}
    </span>
  );
}
