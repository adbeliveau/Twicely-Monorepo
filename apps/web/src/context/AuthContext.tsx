"use client";

import React, { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { clientLogger } from "@/lib/client-logger";

type User = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  role: "BUYER" | "SELLER" | "STAFF";
  storeTier?: string;
  avatarUrl?: string;
  staffRoles?: string[];
  permissions?: string[]; // Flattened permissions for RBAC gating
  emailVerified?: string | null; // ISO string if verified, null otherwise
  isSeller?: boolean; // Whether user is a seller
};

type Session = {
  token: string;
  expiresAt: string;
};

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const storedUser = localStorage.getItem("user");
    const storedSession = localStorage.getItem("session");
    if (!storedUser) return null;
    try {
      const parsedUser = JSON.parse(storedUser);
      const parsedSession = storedSession ? JSON.parse(storedSession) : null;
      if (parsedSession && new Date(parsedSession.expiresAt) <= new Date()) {
        localStorage.removeItem("user");
        localStorage.removeItem("session");
        return null;
      }
      if (parsedUser.role === "STAFF" && !parsedUser.permissions) {
        localStorage.removeItem("user");
        localStorage.removeItem("session");
        return null;
      }
      return parsedUser;
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("session");
      return null;
    }
  });
  const [session, setSession] = useState<Session | null>(() => {
    if (typeof window === "undefined") return null;
    const storedUser = localStorage.getItem("user");
    const storedSession = localStorage.getItem("session");
    if (!storedUser || !storedSession) return null;
    try {
      const parsedUser = JSON.parse(storedUser);
      const parsedSession = JSON.parse(storedSession);
      if (new Date(parsedSession.expiresAt) <= new Date()) return null;
      if (parsedUser.role === "STAFF" && !parsedUser.permissions) return null;
      return parsedSession;
    } catch {
      return null;
    }
  });
  const [loading] = useState(() => typeof window === "undefined");
  const router = useRouter();

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    // Clear logout flag on successful login
    localStorage.removeItem("hasLoggedOut");

    setUser(data.user);
    setSession(data.session);
    localStorage.setItem("user", JSON.stringify(data.user));
    if (data.session) {
      localStorage.setItem("session", JSON.stringify(data.session));
    } else {
      localStorage.removeItem("session");
    }

    // Redirect based on role
    if (data.user.role === "STAFF") {
      router.push("/corp");
    } else if (data.user.role === "SELLER") {
      router.push("/seller");
    } else {
      router.push("/");
    }
  };

  const logout = () => {
    // Clear all auth state
    setUser(null);
    setSession(null);
    localStorage.removeItem("user");
    localStorage.removeItem("session");
    // Set flag to prevent auto-login
    localStorage.setItem("hasLoggedOut", "true");
    router.push("/");
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  // Refresh user data from server
  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
        }
      }
    } catch (error) {
      clientLogger.error("Failed to refresh user", error);
    }
  };

  // Check if user has a specific permission
  // For STAFF users, checks the permissions array
  // Wildcard "*" grants all permissions
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role !== "STAFF") return false;
    if (!user.permissions) return false;
    // Wildcard grants all permissions
    if (user.permissions.includes("*")) return true;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        login,
        logout,
        updateUser,
        hasPermission,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
