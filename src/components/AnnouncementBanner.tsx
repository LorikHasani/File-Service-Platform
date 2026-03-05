import React, { useState } from 'react';
import { X, Info, AlertTriangle, CheckCircle, Megaphone } from 'lucide-react';
import { useAnnouncements } from '@/hooks/useSupabase';
import { Button } from '@/components/ui';

const STORAGE_KEY = 'dismissed_announcements';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

const typeStyles: Record<string, { bg: string; border: string; text: string; iconColor: string }> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-800 dark:text-yellow-200',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-200',
    iconColor: 'text-green-600 dark:text-green-400',
  },
};

const typeIcons: Record<string, React.ReactNode> = {
  info: <Info size={20} />,
  warning: <AlertTriangle size={20} />,
  success: <CheckCircle size={20} />,
};

export const AnnouncementBanner: React.FC = () => {
  const { announcements, loading } = useAnnouncements(true);
  const [dismissed, setDismissedState] = useState<Set<string>>(getDismissed);
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleAnnouncements = announcements.filter((a) => !dismissed.has(a.id));

  const handleDismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissedState(next);
    saveDismissed(next);
    // Move to next or close
    if (currentIndex >= visibleAnnouncements.length - 1) {
      setCurrentIndex(0);
    }
  };

  const handleDismissAll = () => {
    const next = new Set(dismissed);
    visibleAnnouncements.forEach((a) => next.add(a.id));
    setDismissedState(next);
    saveDismissed(next);
  };

  if (loading || visibleAnnouncements.length === 0) return null;

  const current = visibleAnnouncements[currentIndex] || visibleAnnouncements[0];
  if (!current) return null;

  const style = typeStyles[current.type] || typeStyles.info;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Megaphone size={20} className="text-red-600" />
            <h2 className="text-lg font-bold">
              {visibleAnnouncements.length > 1
                ? `News (${currentIndex + 1}/${visibleAnnouncements.length})`
                : 'News'}
            </h2>
          </div>
          <button
            onClick={handleDismissAll}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className={`flex items-start gap-3 p-4 rounded-lg border ${style.bg} ${style.border}`}>
            <span className={`flex-shrink-0 mt-0.5 ${style.iconColor}`}>
              {typeIcons[current.type] || typeIcons.info}
            </span>
            <div className={`flex-1 min-w-0 ${style.text}`}>
              <p className="font-semibold">{current.title}</p>
              <p className="text-sm mt-1 opacity-90 whitespace-pre-wrap">{current.message}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
          {visibleAnnouncements.length > 1 ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(current.id)}
              >
                Dismiss
              </Button>
              <div className="flex gap-2">
                {currentIndex > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                  >
                    Previous
                  </Button>
                )}
                {currentIndex < visibleAnnouncements.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleDismissAll}
                  >
                    Got it
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Button
              className="w-full"
              onClick={() => handleDismiss(current.id)}
            >
              Got it
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
