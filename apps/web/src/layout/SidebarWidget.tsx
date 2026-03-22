"use client";

import Link from "next/link";

export default function SidebarWidget() {
  // Simplified version - shows a generic widget
  // Wire to user context later to show role-specific content
  return (
    <div className="pb-20">
      <div className="mx-auto rounded-2xl bg-gray-50 px-4 py-5 text-center dark:bg-white/[0.03]">
        <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
          Admin Tools
        </h3>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Access platform settings and management tools.
        </p>
        <Link
          href="/corp/settings/platform"
          className="flex items-center justify-center rounded-lg bg-blue-600 p-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          Platform Settings
        </Link>
      </div>
    </div>
  );
}
