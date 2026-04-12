import React, { useState } from 'react';
import { X, Info, AlertTriangle, CheckCircle, Megaphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAnnouncements } from '@/hooks/useSupabase';
import { Button } from '@/components/ui';

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

const getSeenIds = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem('announcements_seen') || '[]');
  } catch {
    return [];
  }
};

const markSeen = (ids: string[]) => {
  const prev = getSeenIds();
  const merged = Array.from(new Set([...prev, ...ids]));
  localStorage.setItem('announcements_seen', JSON.stringify(merged));
};

export const AnnouncementBanner: React.FC = () => {
  const { announcements, loading } = useAnnouncements(true);
  const [closed, setClosed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter out announcements the user has already seen
  const unseen = announcements.filter((a) => !getSeenIds().includes(a.id));

  const handleClose = () => {
    markSeen(unseen.map((a) => a.id));
    setClosed(true);
  };

  if (loading || unseen.length === 0 || closed) return null;

  const current = unseen[currentIndex] || unseen[0];
  if (!current) return null;

  const style = typeStyles[current.type] || typeStyles.info;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header - sticky */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Megaphone size={20} className="text-red-600" />
            <h2 className="text-lg font-bold">
              {unseen.length > 1
                ? `News (${currentIndex + 1}/${unseen.length})`
                : 'News'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {/* Image */}
          {current.image_url && (
            <div className="mb-4 rounded-lg overflow-hidden">
              <img
                src={current.image_url}
                alt={current.title}
                className="w-full max-h-80 object-cover"
              />
            </div>
          )}

          <div className={`flex items-start gap-3 p-4 rounded-lg border ${style.bg} ${style.border}`}>
            <span className={`flex-shrink-0 mt-0.5 ${style.iconColor}`}>
              {typeIcons[current.type] || typeIcons.info}
            </span>
            <div className={`flex-1 min-w-0 ${style.text}`}>
              <p className="font-semibold text-lg">{current.title}</p>
              <p className="text-sm mt-1 opacity-90 whitespace-pre-wrap">{current.message}</p>
            </div>
          </div>
        </div>

        {/* Footer - sticky */}
        <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-shrink-0">
          {unseen.length > 1 ? (
            <>
              <div className="flex gap-1.5">
                {unseen.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === currentIndex ? 'bg-red-600' : 'bg-zinc-300 dark:bg-zinc-600'
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {currentIndex > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentIndex(currentIndex - 1)}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </Button>
                )}
                {currentIndex < unseen.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={() => setCurrentIndex(currentIndex + 1)}
                  >
                    Next
                    <ChevronRight size={16} />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleClose}
                  >
                    Close
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Button
              className="w-full"
              onClick={handleClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
