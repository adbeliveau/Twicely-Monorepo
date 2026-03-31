"use client";
import { useAuth } from "@/context/AuthContext";
import { useStaffAuthOptional } from "@/context/StaffAuthContext";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import {
  ChevronIcon,
  ProfileIcon,
  SellerHubIcon,
  AdminPanelIcon,
  SettingsIcon,
  MessagesIcon,
  SignOutIcon,
  getInitials,
  DROPDOWN_ITEM_CLASS,
} from "./UserDropdownParts";

export default function UserDropdown() {
  const { user, logout, loading } = useAuth();
  const staffAuth = useStaffAuthOptional();
  const [isOpen, setIsOpen] = useState(false);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleLogout = () => {
    closeDropdown();
    if (staffAuth?.staff) {
      staffAuth.logout();
    } else {
      logout();
    }
  };

  // Loading state
  if (loading && !staffAuth?.staff) {
    return (
      <div className="flex items-center">
        <div className="h-11 w-11 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="ml-3 h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  // Staff user logged in (corp admin area)
  if (staffAuth?.staff) {
    const staff = staffAuth.staff;
    const initials = getInitials(staff.displayName);

    return (
      <div className="relative">
        <button
          onClick={toggleDropdown}
          className="flex items-center text-gray-700 dropdown-toggle dark:text-gray-400"
        >
          <span className="mr-3 overflow-hidden rounded-full h-11 w-11">
            <div className="flex h-full w-full items-center justify-center bg-purple-100 text-sm font-medium text-purple-600 dark:bg-purple-900 dark:text-purple-400">
              {initials}
            </div>
          </span>
          <span className="block mr-1 font-medium text-theme-sm">{staff.displayName}</span>
          <ChevronIcon isOpen={isOpen} />
        </button>
        <Dropdown
          isOpen={isOpen}
          onClose={closeDropdown}
          className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
        >
          <div>
            <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
              {staff.displayName}
            </span>
            <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
              {staff.email}
            </span>
            <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              {staff.roles[0] ?? "Staff"}
            </span>
          </div>
          <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
            <li>
              <DropdownItem onItemClick={closeDropdown} tag="a" href="/d" className={DROPDOWN_ITEM_CLASS}>
                Dashboard
              </DropdownItem>
            </li>
            <li>
              <DropdownItem onItemClick={closeDropdown} tag="a" href="/cfg" className={DROPDOWN_ITEM_CLASS}>
                Platform Settings
              </DropdownItem>
            </li>
          </ul>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 mt-3 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
          >
            Sign Out
          </button>
        </Dropdown>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Sign In
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center text-gray-700 dropdown-toggle dark:text-gray-400"
      >
        <span className="mr-3 overflow-hidden rounded-full h-11 w-11">
          {user.avatarUrl ? (
            <Image
              width={44}
              height={44}
              src={user.avatarUrl}
              alt={user.displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-blue-100 text-sm font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-400">
              {getInitials(user.displayName || user.email)}
            </div>
          )}
        </span>
        <span className="block mr-1 font-medium text-theme-sm">{user.displayName}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="block font-medium text-gray-700 text-theme-sm dark:text-gray-400">
            {user.displayName}
          </span>
          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
            {user.email}
          </span>
          {user.role === "SELLER" && (
            <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              Seller {user.sellerTier ? `• ${user.sellerTier}` : ""}
            </span>
          )}
          {user.role === "STAFF" && (
            <span className="mt-1 inline-block rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              Staff
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
          <li>
            <DropdownItem onItemClick={closeDropdown} tag="a" href="/my" className={DROPDOWN_ITEM_CLASS}>
              <ProfileIcon />
              My Account
            </DropdownItem>
          </li>
          {user.role === "SELLER" && (
            <li>
              <DropdownItem onItemClick={closeDropdown} tag="a" href="/my/selling" className={DROPDOWN_ITEM_CLASS}>
                <SellerHubIcon />
                Seller Hub
              </DropdownItem>
            </li>
          )}
          {user.role === "STAFF" && (
            <li>
              <DropdownItem onItemClick={closeDropdown} tag="a" href="/d" className={DROPDOWN_ITEM_CLASS}>
                <AdminPanelIcon />
                Admin Panel
              </DropdownItem>
            </li>
          )}
          <li>
            <DropdownItem onItemClick={closeDropdown} tag="a" href="/my/settings" className={DROPDOWN_ITEM_CLASS}>
              <SettingsIcon />
              Account Settings
            </DropdownItem>
          </li>
          <li>
            <DropdownItem onItemClick={closeDropdown} tag="a" href="/my/messages" className={DROPDOWN_ITEM_CLASS}>
              <MessagesIcon />
              Messages
            </DropdownItem>
          </li>
        </ul>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 mt-3 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          <SignOutIcon />
          Sign Out
        </button>
      </Dropdown>
    </div>
  );
}
