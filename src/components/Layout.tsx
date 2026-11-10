import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, FileUp, FolderOpen, CreditCard, LogOut,
  Menu, X, Moon, Sun, ChevronDown, Users, BarChart3, Gauge, Cpu, Tag, DollarSign,
  MessageSquare, User, Mail, Megaphone, Clock, Package, Receipt, Shield, Image,
  Smartphone,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useBusinessHours } from '@/hooks/useSupabase';
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
// column are hard to scan. Each group collapses; only "Main" (the daily work)
// starts open.
interface NavGroup {
  title: string;
  items: NavItem[];
}

const DEFAULT_OPEN_GROUP = 'Main';
const NAV_GROUPS_STORAGE_KEY = 'sidebar-open-groups';

function loadOpenGroups(): Record<string, boolean> {
  try {
    const saved = JSON.parse(localStorage.getItem(NAV_GROUPS_STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') return saved;
  } catch { /* storage unavailable — fall back to the default */ }
  return { [DEFAULT_OPEN_GROUP]: true };
}

const clientNavGroups: NavGroup[] = [
  {
    title: DEFAULT_OPEN_GROUP,
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={16} /> },
      { label: 'Upload File', href: '/jobs/new', icon: <FileUp size={16} /> },
      { label: 'My Jobs', href: '/jobs', icon: <FolderOpen size={16} /> },
    ],
  },
  {
    title: 'Billing',
    items: [
      { label: 'Prices', href: '/prices', icon: <DollarSign size={16} /> },
      { label: 'Balance', href: '/credits', icon: <CreditCard size={16} /> },
      { label: 'Invoices', href: '/invoices', icon: <Receipt size={16} /> },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile', href: '/profile', icon: <User size={16} /> },
      { label: 'Tickets', href: '/tickets', icon: <MessageSquare size={16} /> },
    ],
  },
];

const adminNavGroups: NavGroup[] = [
  {
    title: DEFAULT_OPEN_GROUP,
    items: [
      { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={16} /> },
      { label: 'All Jobs', href: '/admin/jobs', icon: <FolderOpen size={16} /> },
      { label: 'Tickets', href: '/admin/tickets', icon: <MessageSquare size={16} /> },
    ],
  },
  {
    title: 'Business',
    items: [
      { label: 'Users', href: '/admin/users', icon: <Users size={16} /> },
      { label: 'Transactions', href: '/admin/transactions', icon: <Receipt size={16} /> },
      { label: 'Services', href: '/admin/services', icon: <Tag size={16} /> },
      { label: 'Packages', href: '/admin/packages', icon: <Package size={16} /> },
      { label: 'Statistics', href: '/admin/stats', icon: <BarChart3 size={16} /> },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Emails', href: '/admin/emails', icon: <Mail size={16} /> },
      { label: 'News', href: '/admin/news', icon: <Megaphone size={16} /> },
      { label: 'Banners', href: '/admin/banners', icon: <Image size={16} /> },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Schedule', href: '/admin/schedule', icon: <Clock size={16} /> },
      { label: 'Audit Log', href: '/admin/audit-log', icon: <Shield size={16} /> },
    ],
  },
];

// Tile colour behind each sidebar icon, keyed by link. Full class names so
// Tailwind keeps them. The active link uses a white-on-red tile instead.
const NAV_ICON_COLORS: Record<string, string> = {
  '/dashboard': 'bg-sky-500/15 text-sky-400',
  '/jobs/new': 'bg-emerald-500/15 text-emerald-400',
  '/jobs': 'bg-violet-500/15 text-violet-400',
  '/prices': 'bg-amber-500/15 text-amber-400',
  '/credits': 'bg-teal-500/15 text-teal-400',
  '/invoices': 'bg-orange-500/15 text-orange-400',
  '/profile': 'bg-blue-500/15 text-blue-400',
  '/tickets': 'bg-pink-500/15 text-pink-400',
  '/admin': 'bg-sky-500/15 text-sky-400',
  '/admin/jobs': 'bg-violet-500/15 text-violet-400',
  '/admin/tickets': 'bg-pink-500/15 text-pink-400',
  '/admin/users': 'bg-blue-500/15 text-blue-400',
  '/admin/transactions': 'bg-orange-500/15 text-orange-400',
  '/admin/services': 'bg-amber-500/15 text-amber-400',
  '/admin/packages': 'bg-teal-500/15 text-teal-400',
  '/admin/stats': 'bg-emerald-500/15 text-emerald-400',
  '/admin/emails': 'bg-cyan-500/15 text-cyan-400',
  '/admin/news': 'bg-yellow-500/15 text-yellow-400',
  '/admin/banners': 'bg-fuchsia-500/15 text-fuchsia-400',
  '/admin/schedule': 'bg-indigo-500/15 text-indigo-400',
  '/admin/audit-log': 'bg-rose-500/15 text-rose-400',
};
const NAV_ICON_FALLBACK = 'bg-zinc-800 text-zinc-300';

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

function loadHoursExpanded(): boolean {
  // Open unless this visitor has explicitly collapsed it before.
  try { return localStorage.getItem(HOURS_EXPANDED_KEY) !== '0'; } catch { return true; }
}

const WorkingHoursWidget: React.FC<{ expanded: boolean; onToggle: () => void }> = ({ expanded, onToggle: toggle }) => {
  const { hours, loading } = useBusinessHours();
  // Ticks every second while the full card is showing (for the clock), and
  // once a minute otherwise so the open/closed line stays right.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), expanded ? 1000 : 60000);
    return () => clearInterval(id);
  }, [expanded]);
  const today = now.getDay(); // 0=Sun, 1=Mon...
  // Hours are evaluated in the visitor's own time zone, so that is the clock we show.
  let timeZone = '';
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignore */ }

  // Map day_of_week -> row for quick lookup.
  const byDay = new Map(hours.map((h) => [h.day_of_week, h]));

  const { open, nextOpening } = getOpenStatus(hours, now);

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
    <div className="px-3 pb-3 flex-shrink-0">
      <div className="rounded-xl bg-zinc-800/80 border border-zinc-700/60 px-3 py-2.5">
        {!expanded ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={false}
            title="Show the full week"
            className="w-full flex items-center gap-2"
          >
            <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', open ? 'bg-green-500' : 'bg-red-500')} />
            <span className={clsx('text-xs font-medium truncate', open ? 'text-green-400' : 'text-red-400')}>
              {summary}
            </span>
            <ChevronDown size={14} className="ml-auto flex-shrink-0 text-zinc-400" />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={toggle}
              aria-expanded
              title="Hide the full week"
              className="relative w-full text-center"
            >
              <ChevronDown size={14} className="absolute right-0 top-0 rotate-180 text-zinc-400" />
              <span className="block text-[11px] text-zinc-400">
                Current Time{timeZone ? ` (${timeZone})` : ''}
              </span>
              <span className="block text-lg font-bold text-white tabular-nums">
                {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={clsx('mt-2 flex items-center justify-center gap-2 text-sm font-semibold', open ? 'text-green-400' : 'text-red-400')}>
                <span className={clsx('w-2.5 h-2.5 rounded-full', open ? 'bg-green-500' : 'bg-red-500')} />
                {open ? 'Portal Open' : 'Portal Closed'}
              </span>
              <span className="block text-[11px] text-zinc-400 mt-0.5">{summary}</span>
            </button>

            <p className="mt-3 mb-1.5 text-center text-xs font-semibold text-zinc-200">Working Hours</p>
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
                      dow === today ? 'bg-zinc-700 text-white font-medium' : 'text-zinc-400'
                    )}
                  >
                    <span className="font-semibold">{DAY_LABELS[dow]}</span>
                    <span className={row.is_closed ? 'text-red-400' : ''}>{label}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Sidebar
export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();

  const navGroups = isAdmin ? adminNavGroups : clientNavGroups;

  // Highlight only the most specific link for the current page. Plain prefix
  // matching lit up "My Jobs" on /jobs/new and "Dashboard" on every /admin page.
  const { pathname } = useLocation();
  const activeHref = navGroups
    .flatMap((group) => group.items.map((item) => item.href))
    .filter((href) => pathname === href || pathname.startsWith(href + '/'))
    .sort((a, b) => b.length - a.length)[0];

  // Collapsible groups. The choice is remembered in this browser.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(loadOpenGroups);
  const setGroupOpen = (title: string, open: boolean) => {
    setOpenGroups((prev) => {
      if (!!prev[title] === open) return prev;
      const next = { ...prev, [title]: open };
      try { localStorage.setItem(NAV_GROUPS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Arriving on a page whose link sits in a closed group opens that group,
  // so the highlighted link is never hidden.
  const activeGroupTitle = navGroups.find((group) => group.items.some((item) => item.href === activeHref))?.title;
  useEffect(() => {
    if (activeGroupTitle) setGroupOpen(activeGroupTitle, true);
  }, [activeGroupTitle]);

  // Working hours share the sidebar with the nav. When the open groups leave
  // no room, the week folds itself to its one-line summary. Opening it by hand
  // after that keeps it open and the sidebar scrolls instead.
  const [hoursExpanded, setHoursExpanded] = useState(loadHoursExpanded);
  const hoursExpandedRef = useRef(hoursExpanded);
  hoursExpandedRef.current = hoursExpanded;
  const hoursOpenedByHand = useRef(false);
  const hoursAutoCollapsed = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);

  const toggleHours = () => {
    const next = !hoursExpanded;
    hoursOpenedByHand.current = next;
    hoursAutoCollapsed.current = false;
    try { localStorage.setItem(HOURS_EXPANDED_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    setHoursExpanded(next);
  };

  // A change in the open groups starts over: give the week its room back if we
  // took it, and let the size check below fold it again if it still doesn't fit.
  useEffect(() => {
    hoursOpenedByHand.current = false;
    if (hoursAutoCollapsed.current) {
      hoursAutoCollapsed.current = false;
      setHoursExpanded(true);
    }
  }, [openGroups]);

  useEffect(() => {
    const outer = scrollRef.current;
    const inner = scrollContentRef.current;
    if (!outer || !inner || typeof ResizeObserver === 'undefined') return;
    const check = () => {
      const overflowing = outer.scrollHeight > outer.clientHeight + 1;
      if (overflowing && hoursExpandedRef.current && !hoursOpenedByHand.current) {
        hoursAutoCollapsed.current = true;
        setHoursExpanded(false);
      }
    };
    const observer = new ResizeObserver(check);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={clsx(
        'fixed top-0 left-0 z-50 h-screen w-64 bg-zinc-950 text-white flex flex-col border-r border-zinc-800',
        'transform transition-transform duration-300 ease-in-out lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-wide.png" alt="ChipTuneFiles" className="h-9 w-auto" />
          </Link>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-zinc-800 rounded">
            <X size={20} />
          </button>
        </div>

        {/* Everything between the logo and the account footer scrolls as one */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div ref={scrollContentRef} className="min-h-full flex flex-col">
        <nav className="flex-1 px-3 py-3">
          {navGroups.map((group, index) => {
            const open = !!openGroups[group.title];
            return (
            <div key={group.title} className={clsx(index > 0 && 'mt-2 pt-2 border-t border-zinc-800/70')}>
              <button
                type="button"
                onClick={() => setGroupOpen(group.title, !open)}
                aria-expanded={open}
                className="flex w-full items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
              >
                <span>{group.title}</span>
                <ChevronDown size={16} className={clsx('transition-transform', open && 'rotate-180')} />
              </button>
              {open && (
              <div className="mt-1 space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={onClose}
                    className={clsx(
                      'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] font-medium transition-colors',
                      item.href === activeHref ? 'bg-red-600 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    )}
                  >
                    <span className={clsx(
                      'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md',
                      item.href === activeHref ? 'bg-white/20 text-white' : (NAV_ICON_COLORS[item.href] ?? NAV_ICON_FALLBACK)
                    )}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
              )}
            </div>
            );
          })}
        </nav>

        {/* Working Hours */}
        {!isAdmin && <WorkingHoursWidget expanded={hoursExpanded} onToggle={toggleHours} />}
        </div>
        </div>

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

const WHATSAPP_URL = 'https://wa.me/38344955389';

// Floating WhatsApp button. Sits below the mobile sidebar overlay (z-40).
const WhatsAppButton: React.FC = () => (
  <a
    href={WHATSAPP_URL}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat with us on WhatsApp"
    title="Chat with us on WhatsApp"
    className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/30 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
  >
    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  </a>
);

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
      {!isAdmin && <WhatsAppButton />}
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
          <div className="w-full max-w-md">
            {children}
            <p className="mt-6 text-center text-xs text-zinc-500 lg:hidden">
              Files in under 15 minutes · Free revisions · Mon–Sat 09:00–22:00 CET
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <KikzaCredit variant="auto" />
        </div>
      </div>
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 text-white items-center justify-center p-12 relative overflow-hidden">
        <div className="relative z-10 max-w-lg">
          <img src="/logo-wide.png" alt="ChipTuneFiles" className="w-full max-w-[460px] h-auto mb-10" />
          <h2 className="text-4xl font-bold mb-4">Professional ECU File Service</h2>
          <p className="text-lg text-zinc-400 mb-8">
            Fast, reliable tuning files for workshops and tuners worldwide.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-zinc-900/50 rounded-lg border border-white/5">
              <div className="text-2xl font-bold text-red-500">Free</div>
              <div className="text-sm text-zinc-400">Revisions</div>
            </div>
            <div className="text-center p-4 bg-zinc-900/50 rounded-lg border border-white/5">
              <div className="text-xl leading-8 font-bold text-red-500 whitespace-nowrap">Mon–Sat</div>
              <div className="text-sm text-zinc-400">09:00–22:00 CET</div>
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
