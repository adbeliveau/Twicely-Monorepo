'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { logoutStaffAction } from '@/lib/actions/staff-login';

interface HubUserDropdownProps {
  displayName: string;
  email: string;
  roles: string[];
}

export function HubUserDropdown({ displayName, email, roles }: HubUserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const primaryRole = roles[0] ?? 'Staff';
  const roleLabel = primaryRole.replace(/_/g, ' ');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center text-gray-700 dark:text-gray-400"
      >
        <span className="mr-3 overflow-hidden rounded-full h-11 w-11">
          <div className="flex h-full w-full items-center justify-center bg-purple-100 text-sm font-medium text-purple-600 dark:bg-purple-900 dark:text-purple-400">
            {initials}
          </div>
        </span>
        <span className="mr-1 hidden font-medium text-sm xl:block">
          {displayName}
          <span className="ml-1 text-gray-400 dark:text-gray-500">
            ({roleLabel})
          </span>
        </span>
        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-800 dark:bg-gray-900 z-50">
          {/* User info */}
          <div>
            <span className="block font-medium text-gray-700 text-sm dark:text-gray-300">
              {displayName}
            </span>
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
              {email}
            </span>
            <span className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
              {primaryRole}
            </span>
          </div>

          {/* Links */}
          <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <li>
              <Link
                href="/d"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg text-sm hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/cfg"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg text-sm hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                Platform Settings
              </Link>
            </li>
          </ul>

          {/* Sign Out */}
          <form action={logoutStaffAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-3 py-2 mt-3 font-medium text-gray-700 rounded-lg text-sm hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Sign Out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
