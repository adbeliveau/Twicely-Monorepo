"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

type StaffUser = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
};

type StaffAuthContextType = {
  staff: StaffUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
};

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === "/corp/login";

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.user);
      } else {
        setStaff(null);
      }
    } catch {
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }
    fetchMe();
  }, [fetchMe, isLoginPage]);

  const logout = async () => {
    try {
      await fetch("/api/platform/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore
    }
    setStaff(null);
    router.push("/corp/login");
  };

  const hasPermission = (permission: string): boolean => {
    if (!staff) return false;
    if (staff.roles.includes("SUPER_ADMIN")) return true;
    if (staff.permissions.includes("*")) return true;
    return staff.permissions.includes(permission);
  };

  return (
    <StaffAuthContext.Provider
      value={{ staff, loading, logout, refresh: fetchMe, hasPermission }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const context = useContext(StaffAuthContext);
  if (context === undefined) {
    throw new Error("useStaffAuth must be used within a StaffAuthProvider");
  }
  return context;
}

/** Safe version — returns null when outside StaffAuthProvider instead of throwing */
export function useStaffAuthOptional() {
  return useContext(StaffAuthContext) ?? null;
}
