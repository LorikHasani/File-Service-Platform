import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, MessageSquare, FileText, FolderOpen, X, Trash2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useSupabase';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';

const linkIconMap: Record<string, React.ReactNode> = {
  job: <FolderOpen size={14} />,
  message: <MessageSquare size={14} />,
  file: <FileText size={14} />,
  ticket: <MessageSquare size={14} />,
};

function getNotificationLink(linkType: string | null, linkId: string | null, isAdmin: boolean): string | null {
  if (!linkType || !linkId) return null;
  if (linkType === 'job') return isAdmin ? `/admin/jobs/${linkId}` : `/jobs/${linkId}`;
  if (linkType === 'ticket') return isAdmin ? `/admin/tickets/${linkId}` : `/tickets/${linkId}`;
  return null;
}

export const NotificationDropdown: React.FC<{ isAdmin: boolean }> = ({ isAdmin }) => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-600 text-white text-[10px] font-bold rounded-full px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
            <h3 className="font-semibold text-sm">Notifications</h3>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={12} />
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => clearAll()}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
                  title="Remove all notifications"
                >
                  <Trash2 size={12} />
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => {
                const link = getNotificationLink(notif.link_type, notif.link_id, isAdmin);
                const icon = linkIconMap[notif.link_type || ''] || <Bell size={14} />;

                const handleDelete = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  deleteNotification(notif.id);
                };

                const handleRowClick = () => {
                  if (!notif.is_read) markAsRead(notif.id);
                  if (link) setOpen(false);
                };

                const inner = (
                  <>
                    <div className={clsx(
                      'mt-0.5 p-1.5 rounded-lg flex-shrink-0',
                      !notif.is_read
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    )}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={clsx('text-sm leading-tight', !notif.is_read ? 'font-semibold text-zinc-900 dark:text-white' : 'font-medium text-zinc-700 dark:text-zinc-300')}>
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={handleDelete}
                      className="self-start p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      title="Remove notification"
                      aria-label="Remove notification"
                    >
                      <X size={14} />
                    </button>
                  </>
                );

                const rowClass = clsx(
                  'group flex gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer border-b border-zinc-100 dark:border-zinc-800 last:border-b-0',
                  !notif.is_read && 'bg-blue-50/50 dark:bg-blue-900/10'
                );

                return link ? (
                  <Link key={notif.id} to={link} className={rowClass} onClick={handleRowClick}>
                    {inner}
                  </Link>
                ) : (
                  <div key={notif.id} className={rowClass} onClick={handleRowClick}>
                    {inner}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
