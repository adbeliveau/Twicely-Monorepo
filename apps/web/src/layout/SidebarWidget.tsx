"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

export default function SidebarWidget() {
  const { user } = useAuth();

  // Show different widget based on user role
  if (user?.role === "SELLER") {
    return (
      <div className="pb-20">
        <div className="mx-auto rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-5 text-center">
          <h3 className="mb-2 font-semibold text-white">Boost Your Sales</h3>
          <p className="mb-4 text-sm text-blue-100">
            Promote your listings to reach more buyers and increase visibility.
          </p>
          <Link
            href="/seller/boost"
            className="flex items-center justify-center rounded-lg bg-white p-3 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            Boost Listings
          </Link>
        </div>
      </div>
    );
  }

  if (user?.role === "STAFF") {
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

  // Default buyer widget
  return (
    <div className="pb-20">
      <div className="mx-auto rounded-2xl bg-gradient-to-r from-green-600 to-teal-600 px-4 py-5 text-center">
        <h3 className="mb-2 font-semibold text-white">Start Selling</h3>
        <p className="mb-4 text-sm text-green-100">
          Turn your closet into cash! List items in minutes.
        </p>
        <Link
          href="/seller/onboarding"
          className="flex items-center justify-center rounded-lg bg-white p-3 text-sm font-medium text-green-600 hover:bg-green-50"
        >
          Become a Seller
        </Link>
      </div>
    </div>
  );
}
