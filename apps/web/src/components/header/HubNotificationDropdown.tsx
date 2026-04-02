'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  markStaffNotificationRead,
  markAllStaffNotificationsRead,
  clearStaffNotifications,
} from '@/lib/actions/staff-notifications';
import {
  resolveNotificationLink,
  resolveNotificationTitle,
} from '@/lib/notifications/staff-notification-links';
import { formatRelativeTime } from './notification-time';

interface NotificationItem {
  id: string;
  templateKey: string;
  subject: string | null;
  body: string;
  isRead: boolean;
  createdAt: string;
  dataJson: Record<string, unknown>;
}

const POLL_INTERVAL_MS = 30_000;

export function HubNotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/hub/notifications');
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setNotifications(json.notifications);
        setUnreadCount(json.unreadCount);
      }
    } catch {
      // Silently fail on poll errors
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    const id = setTimeout(() => void fetchNotifications(), 0);
    pollRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(id);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await markStaffNotificationRead(notificationId);
  };

  const handleMarkAllRead = async () => {
    setIsLoading(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await markAllStaffNotificationsRead();
    setIsLoading(false);
  };

  const handleClearAll = async () => {
    setIsLoading(true);
    // Mark all read first, then clear
    await markAllStaffNotificationsRead();
    await clearStaffNotifications();
    await fetchNotifications();
    setIsLoading(false);
  };

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.isRead) {
      handleMarkRead(n.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        aria-label="Notifications"
      >
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400">
            <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping" />
          </span>
        )}
        <BellIcon />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
            <h5 className="text-sm font-semibold text-gray-800 dark:text-white">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  {unreadCount}
                </span>
              )}
            </h5>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={isLoading}
                  className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  disabled={isLoading}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={resolveNotificationLink(n.templateKey, n.dataJson)}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex gap-3 border-b border-gray-100 px-5 py-3 last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50 cursor-pointer ${!n.isRead ? 'bg-brand-50/30 dark:bg-brand-500/5' : ''}`}
                >
                  <NotificationIcon templateKey={n.templateKey} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {resolveNotificationTitle(n.templateKey, n.subject)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {n.body}
                    </p>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  )}
                </Link>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-gray-200 px-5 py-3 dark:border-gray-700">
              <button
                onClick={handleMarkAllRead}
                disabled={isLoading || unreadCount === 0}
                className="w-full text-center text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 disabled:text-gray-400 disabled:cursor-default"
              >
                {unreadCount > 0 ? 'Mark all as read' : 'All caught up'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
        fill="currentColor"
      />
    </svg>
  );
}

function NotificationIcon({ templateKey }: { templateKey: string }) {
  const getIconStyle = (): string => {
    if (templateKey.startsWith('helpdesk.agent.sla'))
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    if (templateKey.startsWith('helpdesk.'))
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    if (templateKey.startsWith('enforcement.'))
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
    if (templateKey.startsWith('order.'))
      return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    if (templateKey.startsWith('dispute.') || templateKey.startsWith('return.'))
      return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
    return 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400';
  };

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${getIconStyle()}`}
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
    </div>
  );
}
