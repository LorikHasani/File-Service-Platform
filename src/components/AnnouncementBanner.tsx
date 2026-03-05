import React, { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAnnouncements } from '@/hooks/useSupabase';

const STORAGE_KEY = 'dismissed_announcements';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function setDismissed(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

const typeStyles: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    icon: <Info size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />,
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-800 dark:text-yellow-200',
    icon: <AlertTriangle size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />,
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-200',
    icon: <CheckCircle size={18} className="text-green-600 dark:text-green-400 flex-shrink-0" />,
  },
};

export const AnnouncementBanner: React.FC = () => {
  const { announcements, loading } = useAnnouncements(true);
  const [dismissed, setDismissedState] = useState<Set<string>>(getDismissed);

  const visibleAnnouncements = announcements.filter((a) => !dismissed.has(a.id));

  const handleDismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissedState(next);
    setDismissed(next);
  };

  if (loading || visibleAnnouncements.length === 0) return null;

  return (
    <div className="space-y-3 mb-6">
      {visibleAnnouncements.map((a) => {
        const style = typeStyles[a.type] || typeStyles.info;
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 p-4 rounded-lg border ${style.bg} ${style.border}`}
          >
            {style.icon}
            <div className={`flex-1 min-w-0 ${style.text}`}>
              <p className="font-semibold text-sm">{a.title}</p>
              <p className="text-sm mt-0.5 opacity-90">{a.message}</p>
            </div>
            <button
              onClick={() => handleDismiss(a.id)}
              className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 flex-shrink-0 ${style.text}`}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
