import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, FileUp, FolderOpen, CreditCard, LogOut,
  Menu, X, Moon, Sun, ChevronDown, Users, BarChart3, Gauge, Cpu, Tag, DollarSign,
  MessageSquare, User, Mail, Megaphone, Clock, Package, Receipt, Shield, Image,
  Smartphone, KeyRound,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBusinessHours, useIsApiPartner } from '@/hooks/useSupabase';
import { getOpenStatus } from '@/lib/businessHours';
import { Avatar, Button } from '@/components/ui';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { GetAppModal } from '@/components/GetAppModal';
import { KikzaCredit } from '@/components/KikzaCredit';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

// Nav is grouped rather than one long list: fourteen admin entries in a flat
// column are hard to scan, and the first group is the daily work, so it carries
// no heading — you reach the everyday screens without reading anything.
interface NavGroup {
  title?: string;
  items: NavItem[];
}

const clientNavGroups: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} /> },
      { label: 'Upload File', href: '/jobs/new', icon: <FileUp size={18} /> },
      { label: 'My Jobs', href: '/jobs', icon: <FolderOpen size={18} /> },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'Prices', href: '/prices', icon: <DollarSign size={18} /> },
      { label: 'Balance', href: '/credits', icon: <CreditCard size={18} /> },
      { label: 'Invoices', href: '/invoices', icon: <Receipt size={18} /> },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile', href: '/profile', icon: <User size={18} /> },
      { label: 'Tickets', href: '/tickets', icon: <MessageSquare size={18} /> },
    ],
  },
];

const adminNavGroups: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={18} /> },
      { label: 'All Jobs', href: '/admin/jobs', icon: <FolderOpen size={18} /> },
      { label: 'Tickets', href: '/admin/tickets', icon: <MessageSquare size={18} /> },
    ],
  },
  {
    title: 'Business',
    items: [
      { label: 'Users', href: '/admin/users', icon: <Users size={18} /> },
      { label: 'Transactions', href: '/admin/transactions', icon: <Receipt size={18} /> },
      { label: 'Services', href: '/admin/services', icon: <Tag size={18} /> },
      { label: 'Packages', href: '/admin/packages', icon: <Package size={18} /> },
      { label: 'Statistics', href: '/admin/stats', icon: <BarChart3 size={18} /> },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Emails', href: '/admin/emails', icon: <Mail size={18} /> },
      { label: 'News', href: '/admin/news', icon: <Megaphone size={18} /> },
      { label: 'Banners', href: '/admin/banners', icon: <Image size={18} /> },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Schedule', href: '/admin/schedule', icon: <Clock size={18} /> },
      { label: 'Partner API', href: '/admin/api-keys', icon: <KeyRound size={18} /> },
      { label: 'Audit Log', href: '/admin/audit-log', icon: <Shield size={18} /> },
    ],
  },
];

// Working Hours Widget — schedule is admin-editable (see /admin/schedule)
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Order the widget rows Mon → Sun (day_of_week values 1..6 then 0).
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// Format minutes-from-midnight as e.g. "9:00 AM".
export function formatMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

// The week is shown in full by default — clients should see when we are open
// without having to ask for it. Anyone who finds it long can collapse it to a
// single line carrying what actually matters (open or closed, and until/from
// when), and that choice is remembered.
const HOURS_EXPANDED_KEY = 'workingHoursExpanded';

const WorkingHoursWidget: React.FC = () => {
  const { hours, loading } = useBusinessHours();
  const today = new Date().getDay(); // 0=Sun, 1=Mon...
  // Open unless this visitor has explicitly collapsed it before.
  const [expanded, setExpanded] = useState(
    () => localStorage.getItem(HOURS_EXPANDED_KEY) !== '0'
  );

  const toggle = () => {
    setExpanded((was) => {
      localStorage.setItem(HOURS_EXPANDED_KEY, was ? '0' : '1');
      return !was;
    });
  };

  // Map day_of_week -> row for quick lookup.
  const byDay = new Map(hours.map((h) => [h.day_of_week, h]));

  const { open, nextOpening } = getOpenStatus(hours);

  if (loading || hours.length === 0) return null;

  const todayRow = byDay.get(today);

  let summary: string;
  if (open) {
    summary = todayRow && !todayRow.is_closed
      ? `Open until ${formatMinutes(todayRow.close_minutes)}`
      : 'Open';
  } else if (nextOpening) {
    const when =
      nextOpening.daysAhead === 0 ? ''
      : nextOpening.daysAhead === 1 ? 'tomorrow '
      : `${DAY_LABELS[nextOpening.dayOfWeek]} `;
    summary = `Closed · opens ${when}${formatMinutes(nextOpening.minutes)}`;
  } else {
    summary = 'Closed';
  }

  return (
    <div className="px-4 py-2.5 border-t border-zinc-800 flex-shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        title={expanded ? 'Hide the full week' : 'Show the full week'}
        className="w-full flex items-center gap-2 rounded px-1 py-1 -mx-1 hover:bg-zinc-800/60 transition-colors"
      >
        <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', open ? 'bg-green-500' : 'bg-red-500')} />
        <span className={clsx('text-[11px] font-medium truncate', open ? 'text-green-400' : 'text-red-400')}>
          {summary}
        </span>
        <ChevronDown
          size={13}
          className={clsx(
            'ml-auto flex-shrink-0 text-zinc-500 transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {expanded && (
        <>
          <div className="flex items-center gap-2 mt-2.5 mb-1.5">
            <Clock size={13} className="text-zinc-500" />
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Working Hours
            </span>
          </div>
          <div className="space-y-0.5">
            {DISPLAY_ORDER.map((dow) => {
              const row = byDay.get(dow);
              if (!row) return null;
              const label = row.is_closed
                ? 'Closed'
                : `${formatMinutes(row.open_minutes)} - ${formatMinutes(row.close_minutes)}`;
              return (
                <div
                  key={dow}
                  className={clsx(
                    'flex items-center justify-between text-[11px] px-2 py-0.5 rounded',
                    dow === today ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-500'
                  )}
                >
                  <span>{DAY_LABELS[dow]}</span>
                  <span className={row.is_closed ? 'text-red-400' : ''}>{label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// Sidebar
export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const isApiPartner = useIsApiPartner();
  const [getAppOpen, setGetAppOpen] = useState(false);

  // "API Access" appears only for clients who actually have a key, so the
  // sidebar stays uncluttered for everyone else. It joins the Account group.
  const navGroups = isAdmin
    ? adminNavGroups
    : isApiPartner
      ? clientNavGroups.map((group) =>
          group.title === 'Account'
            ? {
                ...group,
                items: [
                  ...group.items,
                  { label: 'API Access', href: '/api-access', icon: <KeyRound size={18} /> },
                ],
              }
            : group
        )
      : clientNavGroups;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={clsx(
        'fixed top-0 left-0 z-50 h-screen w-64 bg-zinc-950 text-white flex flex-col',
        'transform transition-transform duration-300 ease-in-out lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="ChipTuneFiles" className="h-7" />
          </Link>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-zinc-800 rounded">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto min-h-0">
          {navGroups.map((group, index) => (
            <div key={group.title ?? 'main'} className={clsx(index > 0 && 'mt-4')}>
              {group.title && (
                <p className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                  {group.title}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={onClose}
                    className={({ isActive }) => clsx(
                      'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                      isActive ? 'bg-red-600 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Get the App */}
        <div className="px-3 pb-1 flex-shrink-0">
          <button
            onClick={() => setGetAppOpen(true)}
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Smartphone size={18} />
            <span>Get the App</span>
          </button>
        </div>

        {/* Working Hours */}
        {!isAdmin && <WorkingHoursWidget />}

        <div className="p-3 border-t border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <Avatar name={profile?.contact_name || 'User'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate">{profile?.contact_name}</p>
              <p className="text-[11px] text-zinc-400 truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 mt-1 rounded-lg text-[13px] font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Rendered outside <aside> — its transform would trap position:fixed */}
      <GetAppModal open={getAppOpen} onClose={() => setGetAppOpen(false)} />
    </>
  );
};

// Header
export const Header: React.FC<{ onMenuClick: () => void; title?: string }> = ({ onMenuClick, title }) => {
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [getAppOpen, setGetAppOpen] = useState(false);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode(!darkMode);
    localStorage.setItem('theme', darkMode ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <button onClick={onMenuClick} className="lg:hidden p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            <Menu size={20} />
          </button>
          {title && <h1 className="text-xl font-semibold">{title}</h1>}
        </div>

        <div className="flex items-center gap-2">
          {profile?.role === 'client' && (
            <Link to="/credits" className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm font-medium">
              <CreditCard size={16} className="text-red-600" />
              <span>€{profile.credit_balance.toFixed(2)}</span>
            </Link>
          )}

          <button
            onClick={() => setGetAppOpen(true)}
            title="Get the App"
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <Smartphone size={20} />
          </button>

          <button onClick={toggleDarkMode} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <NotificationDropdown isAdmin={isAdmin} />
        </div>
      </div>

      <GetAppModal open={getAppOpen} onClose={() => setGetAppOpen(false)} />
    </header>
  );
};

// Main Layout
export const Layout: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            {!isAdmin && <AnnouncementBanner />}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

// Auth Layout
export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex flex-col p-8">
        <div className="mb-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
            ← Back to Home
          </Link>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <div className="mt-4 flex justify-center">
          <KikzaCredit variant="auto" />
        </div>
      </div>
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 text-white items-center justify-center p-12 relative overflow-hidden">
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.png" alt="ChipTuneFiles" className="h-14" />
          </div>
          <h2 className="text-4xl font-bold mb-4">Professional ECU File Service</h2>
          <p className="text-lg text-zinc-400 mb-8">
            Fast, reliable tuning files for workshops and tuners worldwide.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-zinc-900/50 rounded-lg border border-white/5">
              <div className="text-2xl font-bold text-red-500">2,500+</div>
              <div className="text-sm text-zinc-400">Happy Clients</div>
            </div>
            <div className="text-center p-4 bg-zinc-900/50 rounded-lg border border-white/5">
              <div className="text-2xl font-bold text-red-500">10k+</div>
              <div className="text-sm text-zinc-400">Files Delivered</div>
            </div>
            <div className="text-center p-4 bg-zinc-900/50 rounded-lg border border-white/5">
              <div className="text-2xl font-bold text-red-500">&lt;15min</div>
              <div className="text-sm text-zinc-400">Avg. Turnaround</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
