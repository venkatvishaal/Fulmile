import React, { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import {
  BsGrid1X2, BsSignpost2, BsTruck, BsPersonBadge, BsWrench, BsFuelPump,
  BsBarChartLine, BsBoxSeam, BsGeoAlt, BsList, BsX, BsBoxArrowRight, BsGear,
  BsPlusCircle
} from 'react-icons/bs';
import { logoutSuccess } from '../../redux/slices/authSlice';
import authService from '../../services/authService';
import Onboarding from './Onboarding';

// Browser tab titles. Unknown paths fall back to the bare product name.
const TITLES = {
  '/': 'Smart transport operations',
  '/login': 'Sign in',
  '/register': 'Create account',
  '/dashboard': 'Dashboard',
  '/trips': 'Trips',
  '/vehicles': 'Vehicles',
  '/drivers': 'Drivers',
  '/maintenance': 'Maintenance',
  '/fuel-logs': 'Fuel & expenses',
  '/reports': 'Reports',
  '/shared-search': 'Shared cargo',
  '/track': 'Track cargo',
  '/account': 'Your account',
  '/privacy': 'Privacy policy',
  '/terms': 'Terms of service',
  '/book-freight': 'Book freight cargo',
  '/my-bookings': 'My shipments',
  '/freight-requests': 'Freight requests'
};

// These pages bring their own full-screen layout when signed out.
const STANDALONE = ['/', '/login', '/register'];

// Roles mirror the <PrivateRoute allowedRoles> in App.js; omitted roles = every signed-in user.
const NAV = [
  {
    group: 'Freight Portal',
    items: [
      { to: '/book-freight', label: 'Book freight', icon: BsPlusCircle, roles: ['shipper'] },
      { to: '/shared-search', label: 'Shared cargo', icon: BsBoxSeam, roles: ['shipper'] },
      { to: '/my-bookings', label: 'My shipments', icon: BsBoxSeam, roles: ['shipper'] },
      { to: '/track', label: 'Track cargo', icon: BsGeoAlt, roles: ['shipper'] },
    ],
  },
  {
    group: 'Operations',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: BsGrid1X2, roles: ['fleet_manager', 'driver', 'safety_officer', 'financial_analyst'] },
      { to: '/trips', label: 'Trips', icon: BsSignpost2, roles: ['fleet_manager', 'driver'] },
      { to: '/freight-requests', label: 'Freight requests', icon: BsBoxSeam, roles: ['fleet_manager'] },
      { to: '/vehicles', label: 'Vehicles', icon: BsTruck, roles: ['fleet_manager'] },
      { to: '/drivers', label: 'Drivers', icon: BsPersonBadge, roles: ['fleet_manager', 'safety_officer'] },
      { to: '/maintenance', label: 'Maintenance', icon: BsWrench, roles: ['fleet_manager'] },
    ],
  },
  {
    group: 'Finance',
    items: [
      { to: '/fuel-logs', label: 'Fuel & expenses', icon: BsFuelPump, roles: ['fleet_manager', 'driver', 'financial_analyst'] },
      { to: '/reports', label: 'Reports', icon: BsBarChartLine, roles: ['fleet_manager', 'financial_analyst'] },
    ],
  },
  {
    group: 'Network',
    items: [
      { to: '/track', label: 'Track cargo', icon: BsGeoAlt, roles: ['fleet_manager', 'driver', 'safety_officer', 'financial_analyst'] },
    ],
  },
];

const formatRole = (role) => (role ? role.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') : '');

export function Logo({ inverted = false }) {
  return (
    <span className={`flex items-center gap-2.5 text-[17px] font-bold tracking-tight ${inverted ? 'text-paper' : 'text-ink'}`} style={{ fontStretch: '85%' }}>
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect width="22" height="22" rx="4" fill="rgb(var(--signal))" />
        <path d="M5 15.5h5.5a2.5 2.5 0 0 0 0-5h-1a2.5 2.5 0 0 1 0-5H17" fill="none" stroke="rgb(var(--ink))" strokeWidth="2" strokeLinecap="round" />
        <circle cx="5" cy="15.5" r="1.6" fill="rgb(var(--ink))" />
        <circle cx="17" cy="5.5" r="1.6" fill="rgb(var(--ink))" />
      </svg>
      TransitOps
    </span>
  );
}

function NavList({ role, onNavigate }) {
  return (
    <nav aria-label="Primary" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {NAV.map(({ group, items }) => {
        const visible = items.filter((i) => !i.roles || i.roles.includes(role));
        if (!visible.length) return null;
        return (
          <div key={group}>
            <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/45">{group}</p>
            <ul className="space-y-0.5">
              {visible.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 rounded px-3 py-2 text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-paper/10 text-paper before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-signal'
                          : 'text-paper/65 hover:bg-paper/5 hover:text-paper'
                      }`
                    }
                  >
                    <Icon aria-hidden="true" className="shrink-0 text-[15px]" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function UserFooter({ user, onLogout }) {
  const name = user?.name || user?.username || user?.email;
  return (
    <div className="flex items-center gap-3 border-t border-paper/10 px-4 py-4">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper/10 text-xs font-semibold uppercase text-paper">
        {name?.[0]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-paper">{name}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-signal">{formatRole(user?.role)}</p>
      </div>
      <Link to="/account" className="rounded p-2 text-paper/60 transition-colors hover:bg-paper/10 hover:text-paper" aria-label="Account settings" title="Account settings">
        <BsGear aria-hidden="true" />
      </Link>
      <button type="button" onClick={onLogout} className="rounded p-2 text-paper/60 transition-colors hover:bg-paper/10 hover:text-paper" aria-label="Log out" title="Log out">
        <BsBoxArrowRight aria-hidden="true" />
      </button>
    </div>
  );
}

function PublicBar() {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-content items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" aria-label="TransitOps home"><Logo /></Link>
        <nav aria-label="Public" className="flex items-center gap-1 text-[13px] font-medium">
          <NavLink to="/track" className={({ isActive }) => `rounded px-3 py-1.5 ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`}>Track cargo</NavLink>
          <NavLink to="/login" className={({ isActive }) => `rounded px-3 py-1.5 ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`}>Sign in</NavLink>
          <Link to="/register" className="btn btn-primary btn-sm ml-1">Register</Link>
        </nav>
      </div>
    </header>
  );
}

export default function AppShell({ children }) {
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef(null);

  const closeDrawer = () => drawerRef.current?.close();

  // Close the mobile drawer on any route change.
  useEffect(() => { closeDrawer(); }, [location.pathname]);

  useEffect(() => {
    const page = TITLES[location.pathname] || (location.pathname.startsWith('/track/') ? 'Track cargo' : null);
    document.title = page ? `${page} · TransitOps` : 'TransitOps';
  }, [location.pathname]);

  const handleLogout = async () => {
    closeDrawer();
    await authService.logout().catch(() => {});
    dispatch(logoutSuccess());
    toast.info('Logged out successfully');
    navigate('/login');
  };

  if (!isAuthenticated) {
    if (STANDALONE.includes(location.pathname)) return children;
    return (
      <div className="flex min-h-screen flex-col">
        <PublicBar />
        <main className="flex-1">{children}</main>
      </div>
    );
  }

  const isShipper = user?.role === 'shipper';
  const homePath = isShipper ? '/my-bookings' : '/dashboard';

  return (
    <div className="min-h-screen lg:pl-[232px]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-signal focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 hidden w-[232px] flex-col bg-ink lg:flex">
        <Link to={homePath} className="px-6 pb-2 pt-6" aria-label="TransitOps home"><Logo inverted /></Link>
        <NavList role={user?.role} />
        <UserFooter user={user} onLogout={handleLogout} />
      </aside>

      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
        <Link to={homePath} aria-label="TransitOps home"><Logo inverted /></Link>
        <button
          type="button"
          onClick={() => drawerRef.current?.showModal()}
          className="rounded p-2 text-paper hover:bg-paper/10"
          aria-label="Open navigation"
        >
          <BsList className="text-xl" aria-hidden="true" />
        </button>
      </header>

      <dialog
        ref={drawerRef}
        aria-label="Navigation"
        onClick={(e) => { if (e.target === drawerRef.current) closeDrawer(); }}
        className="m-0 ml-0 h-[100dvh] max-h-none w-[min(300px,85vw)] bg-transparent p-0 lg:hidden"
      >
        <div className="flex h-full flex-col bg-ink">
          <div className="flex items-center justify-between px-5 pt-5">
            <Logo inverted />
            <button type="button" onClick={closeDrawer} className="rounded p-2 text-paper hover:bg-paper/10" aria-label="Close navigation">
              <BsX className="text-xl" aria-hidden="true" />
            </button>
          </div>
          <NavList role={user?.role} onNavigate={closeDrawer} />
          <UserFooter user={user} onLogout={handleLogout} />
        </div>
      </dialog>

      <Onboarding key={user?.id} user={user} />

      <main id="main" tabIndex={-1} className="mx-auto max-w-content px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}
