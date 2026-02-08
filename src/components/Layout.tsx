import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, FileUp, FolderOpen, CreditCard, Settings, LogOut,
  Menu, X, Bell, Moon, Sun, ChevronDown, Users, BarChart3, Gauge,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Avatar, Button } from '@/components/ui';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const clientNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'New Job', href: '/jobs/new', icon: <FileUp size={20} /> },
  { label: 'My Jobs', href: '/jobs', icon: <FolderOpen size={20} /> },
  { label: 'Calculator', href: '/calculator', icon: <Gauge size={20} /> },
  { label: 'Credits', href: '/credits', icon: <CreditCard size={20} /> },
  { label: 'Settings', href: '/settings', icon: <Settings size={20} /> },
];

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard size={20} /> },
  { label: 'All Jobs', href: '/admin/jobs', icon: <FolderOpen size={20} /> },
  { label: 'Users', href: '/admin/users', icon: <Users size={20} /> },
  { label: 'Statistics', href: '/admin/stats', icon: <BarChart3 size={20} /> },
];

// Sidebar
export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();
  const navItems = isAdmin ? adminNavItems : clientNavItems;

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
        <div className="flex items-center justify-between h-16 px-6 border-b border-zinc-800 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2">
            <Gauge className="w-8 h-8 text-red-600" />
            <span className="text-xl font-bold">TuneForge</span>
          </Link>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-zinc-800 rounded">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto min-h-0">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-red-600 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar name={profile?.contact_name || 'User'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.contact_name}</p>
              <p className="text-xs text-zinc-400 truncate">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 mt-2 rounded-lg text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <LogOut size={20} />
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
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));

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
              <span>{profile.credit_balance.toFixed(2)} Credits</span>
            </Link>
          )}

          <button onClick={toggleDarkMode} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg relative">
            <Bell size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

// Main Layout
export const Layout: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

// Auth Layout
export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 text-white items-center justify-center p-12 relative overflow-hidden">
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-8">
            <Gauge className="w-12 h-12 text-red-600" />
            <span className="text-3xl font-bold">TuneForge</span>
          </div>
          <h2 className="text-4xl font-bold mb-4">Professional ECU Tuning Services</h2>
          <p className="text-lg text-zinc-400 mb-8">
            Fast, reliable file service for workshops and tuners worldwide.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-zinc-900/50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">1000+</div>
              <div className="text-sm text-zinc-400">Happy Clients</div>
            </div>
            <div className="text-center p-4 bg-zinc-900/50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">50k+</div>
              <div className="text-sm text-zinc-400">Files Processed</div>
            </div>
            <div className="text-center p-4 bg-zinc-900/50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">&lt;2h</div>
              <div className="text-sm text-zinc-400">Avg. Turnaround</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
