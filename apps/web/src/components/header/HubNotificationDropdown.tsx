'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export function HubNotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications] = useState<Array<{ id: string; title: string; message: string; time: string; read: boolean; link: string }>>([
    { id: '1', title: 'New support case', message: 'Case #1234 assigned to you', time: '5m ago', read: false, link: '/hd/cases' },
    { id: '2', title: 'Seller verification', message: 'New ID verification pending review', time: '1h ago', read: false, link: '/usr/sellers/verification' },
    { id: '3', title: 'System health', message: 'All systems operational', time: '3h ago', read: true, link: '/health' },
  ]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

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
        <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20">
          <path fillRule="evenodd" clipRule="evenodd" d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z" fill="currentColor" />
        </svg>
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
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => setIsOpen(false)}
                className={`flex gap-3 border-b border-gray-100 px-5 py-3 last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50 cursor-pointer ${!n.read ? 'bg-brand-50/30 dark:bg-brand-500/5' : ''}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{n.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{n.message}</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{n.time}</p>
                </div>
                {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
              </Link>
            ))}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block py-3 text-center text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              View All Notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
