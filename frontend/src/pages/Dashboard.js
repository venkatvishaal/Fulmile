import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import io from 'socket.io-client';
import { BsArrowRight } from 'react-icons/bs';
import { FaRoute, FaArrowRight } from 'react-icons/fa';
import { fetchDashboard } from '../redux/slices/analyticsSlice';
import KpiCard from '../components/ui/KpiCard';
import PageHeader from '../components/ui/PageHeader';
import ErrorBanner from '../components/ui/ErrorBanner';
import { RollingNumber } from '../components/ui/RollingNumber';

const SOCKET_URL = process.env.REACT_APP_API_BASE_URL
  ? process.env.REACT_APP_API_BASE_URL.replace('/api', '')
  : 'http://localhost:5000';

const VEHICLE_STATES = [
  { key: 'Available', bar: 'bg-ok' },
  { key: 'On Trip', bar: 'bg-transit' },
  { key: 'In Shop', bar: 'bg-signal' },
  { key: 'Retired', bar: 'bg-muted/50' },
];

const DRIVER_STATES = [
  { key: 'Available', bar: 'bg-ok' },
  { key: 'On Trip', bar: 'bg-transit' },
  { key: 'Off Duty', bar: 'bg-muted/50' },
  { key: 'Suspended', bar: 'bg-danger' },
];

const QUICK_LINKS = {
  fleet_manager: [
    { to: '/trips', label: 'Plan a dispatch', body: 'Create, dispatch and track trips' },
    { to: '/vehicles', label: 'Fleet registry', body: 'Register or retire vehicles' },
    { to: '/maintenance', label: 'Schedule maintenance', body: 'Open and close service logs' },
  ],
  driver: [
    { to: '/trips', label: 'My trips', body: 'Dispatches assigned to you' },
    { to: '/fuel-logs', label: 'Log fuel', body: 'Record a fill-up against a trip' },
  ],
  safety_officer: [
    { to: '/drivers', label: 'Driver compliance', body: 'Licences and safety scores' },
  ],
  financial_analyst: [
    { to: '/reports', label: 'Financial reports', body: 'Operating cost and ROI per asset' },
    { to: '/fuel-logs', label: 'Expenses', body: 'Fuel and trip expense ledger' },
  ],
};

function LiveIndicator({ status }) {
  const map = {
    connected: { dot: 'bg-ok', text: 'Live', ping: true },
    connecting: { dot: 'bg-signal', text: 'Connecting…' },
    offline: { dot: 'bg-danger', text: 'Offline — showing last data' },
  };
  const s = map[status];
  return (
    <span role="status" className="inline-flex items-center gap-2 rounded border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        {s.ping && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${s.dot}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
      </span>
      {s.text}
    </span>
  );
}

// Horizontal stacked bar of state counts — a status board, not a decorative chart.
function StateBoard({ title, counts, states, to, linkLabel }) {
  const total = states.reduce((sum, s) => sum + (counts[s.key] || 0), 0);
  return (
    <section className="panel p-5" aria-labelledby={`board-${title}`}>
      <div className="flex items-baseline justify-between">
        <h2 id={`board-${title}`} className="text-base font-semibold">{title}</h2>
        <span className="num text-sm text-muted">{total} total</span>
      </div>
      <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
        {total > 0 && states.map((s) => {
          const n = counts[s.key] || 0;
          return n ? <div key={s.key} className={`${s.bar} h-full transition-[width] duration-500`} style={{ width: `${(n / total) * 100}%` }} /> : null;
        })}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {states.map((s) => (
          <div key={s.key}>
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`h-2 w-2 rounded-sm ${s.bar}`} aria-hidden="true" />{s.key}
            </dt>
            <dd className="num mt-0.5 text-lg font-semibold"><RollingNumber value={counts[s.key] || 0} /></dd>
          </div>
        ))}
      </dl>
      {to && (
        <Link to={to} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink hover:underline">
          {linkLabel} <BsArrowRight aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function TripPipeline({ trips }) {
  const stages = [
    { key: 'Draft', label: 'Planned' },
    { key: 'Dispatched', label: 'On the road' },
    { key: 'Completed', label: 'Delivered' },
  ];
  return (
    <section className="panel p-5" aria-labelledby="pipeline-title">
      <div className="flex items-baseline justify-between">
        <h2 id="pipeline-title" className="text-base font-semibold">Trip pipeline</h2>
        <span className="num text-sm text-muted">{trips.Cancelled || 0} cancelled</span>
      </div>
      <ol className="mt-4 grid grid-cols-3">
        {stages.map((s, i) => (
          <li key={s.key} className={`relative pr-3 ${i > 0 ? 'border-l border-line pl-4' : ''}`}>
            <p className="eyebrow">{String(i + 1).padStart(2, '0')} · {s.label}</p>
            <p className="num mt-1.5 text-[28px] font-semibold leading-none"><RollingNumber value={trips[s.key] || 0} /></p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" className="space-y-6">
      <div className="panel grid grid-cols-2 divide-x divide-line lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 px-5 py-4"><div className="skeleton h-3 w-24" /><div className="skeleton h-7 w-16" /></div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="skeleton h-48" /><div className="skeleton h-48" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const dispatch = useDispatch();
  const { data, loading, error } = useSelector((state) => state.analytics);
  const { user } = useSelector((state) => state.auth);
  const [socketStatus, setSocketStatus] = useState('connecting');

  useEffect(() => {
    dispatch(fetchDashboard());

    const socket = io(SOCKET_URL);
    socket.on('connect', () => {
      setSocketStatus('connected');
      socket.emit('join', 'fleet');
    });
    socket.on('disconnect', () => setSocketStatus('offline'));
    socket.on('connect_error', () => setSocketStatus('offline'));
    socket.on('fleet:update', () => dispatch(fetchDashboard()));

    return () => socket.disconnect();
  }, [dispatch]);

  const firstLoad = loading && !data.vehicles.total;
  const links = QUICK_LINKS[user?.role] || [];
  const name = user?.name || user?.username;

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        title="Operations control"
        description={name ? `Welcome back, ${name}. Fleet state updates as trips and vehicles change.` : undefined}
        actions={<LiveIndicator status={socketStatus} />}
      />

      <ErrorBanner message={error} onRetry={() => dispatch(fetchDashboard())} />

      {firstLoad ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <section aria-label="Key figures" className="panel grid grid-cols-2 divide-line lg:grid-cols-5 [&>*:nth-child(odd)]:border-r [&>*:nth-child(n+3)]:border-t lg:[&>*]:border-t-0 lg:[&>*:not(:last-child)]:border-r">
            <KpiCard title="Delivered Revenue" value={`₹${(data.financialSummary?.totalGrossRevenue || 0).toLocaleString()}`} suffix={`(${data.financialSummary?.totalCompletedTrips || 0} trips)`} tone="bg-ink" hint="Completed dispatch settlements" />
            <KpiCard title="Shared cargo profit" value={`₹${(data.sharedCargoAnalytics?.totalPureProfit || 0).toLocaleString()}`} tone="bg-emerald-500" hint="100% net margin pure profit" />
            <KpiCard title="Trip fuel cost" value={`₹${(data.financialSummary?.totalFuelCost || 0).toLocaleString()}`} tone="bg-signal" hint="Settled fuel expense" />
            <KpiCard title="Net trip profit" value={`+₹${(data.financialSummary?.totalNetProfit || 0).toLocaleString()}`} suffix={`(${data.financialSummary?.overallMarginPct || 0}%)`} tone="bg-ok" hint="Operating profit margin" />
            <KpiCard title="Fleet utilisation" value={data.utilization || 0} suffix="%" hint="On-trip share of active fleet" tone="bg-transit" />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <StateBoard
              title="Vehicles"
              counts={data.vehicles}
              states={VEHICLE_STATES}
              to={user?.role === 'fleet_manager' ? '/vehicles' : undefined}
              linkLabel="Open registry"
            />
            <StateBoard
              title="Drivers"
              counts={data.drivers}
              states={DRIVER_STATES}
              to={['fleet_manager', 'safety_officer'].includes(user?.role) ? '/drivers' : undefined}
              linkLabel="Open driver registry"
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
            <TripPipeline trips={data.trips} />

            {links.length > 0 && (
              <section className="panel" aria-labelledby="actions-title">
                <h2 id="actions-title" className="border-b border-line px-5 py-4 text-base font-semibold">Your shortcuts</h2>
                <ul className="divide-y divide-line">
                  {links.map((l) => (
                    <li key={l.to + l.label}>
                      <Link to={l.to} className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-paper/60">
                        <span>
                          <span className="block text-sm font-semibold">{l.label}</span>
                          <span className="block text-xs text-muted">{l.body}</span>
                        </span>
                        <BsArrowRight aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Completed Trips Financial Settlement Panel */}
          {data.completedTripsFinancials && data.completedTripsFinancials.length > 0 && (
            <section className="panel p-5" aria-labelledby="completed-trips-title">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <FaRoute className="text-blue-600" />
                  <h2 id="completed-trips-title" className="text-base font-semibold">Completed Trips Financial Settlement</h2>
                </div>
                <Link to="/reports" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline">
                  Full Financial Ledger & Audit <BsArrowRight />
                </Link>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-line text-muted uppercase font-mono font-bold tracking-wider">
                      <th className="pb-2">Trip / Route</th>
                      <th className="pb-2">Vehicle</th>
                      <th className="pb-2">Primary Freight</th>
                      <th className="pb-2 text-emerald-700">Shared Cargo Profit</th>
                      <th className="pb-2">Gross Revenue</th>
                      <th className="pb-2 text-red-600">Fuel Cost</th>
                      <th className="pb-2 text-emerald-700">Net Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {data.completedTripsFinancials.slice(0, 5).map((ct) => (
                      <tr key={ct.id} className="hover:bg-paper/40 transition">
                        <td className="py-2.5">
                          <span className="font-mono font-bold text-ink">{ct.tracking_id}</span>
                          <div className="font-semibold text-ink/80 text-[11px]">
                            {ct.source} <FaArrowRight className="inline text-[9px] text-muted mx-0.5" /> {ct.destination}
                          </div>
                        </td>
                        <td className="py-2.5 font-mono text-muted">{ct.vehicle_registration}</td>
                        <td className="py-2.5 font-mono font-semibold">₹{ct.primary_revenue.toLocaleString()}</td>
                        <td className="py-2.5 font-mono text-emerald-700 font-bold">
                          {ct.shared_cargo_revenue > 0 ? `+₹${ct.shared_cargo_revenue.toLocaleString()}` : '—'}
                        </td>
                        <td className="py-2.5 font-mono font-bold">₹{ct.total_revenue.toLocaleString()}</td>
                        <td className="py-2.5 font-mono text-red-600 font-semibold">-₹{ct.fuel_cost.toLocaleString()}</td>
                        <td className="py-2.5 font-mono font-black text-emerald-700">
                          +₹{ct.net_profit.toLocaleString()} ({ct.profit_margin_pct}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
