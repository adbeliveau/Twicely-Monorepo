"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  email: string;
  displayName: string;
  username: string;
  role: "BUYER" | "SELLER" | "STAFF";
  sellerTier?: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load session from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedSession = localStorage.getItem("session");

    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const parsedSession = storedSession ? JSON.parse(storedSession) : null;

        // Check if session is expired (only if session exists)
        if (parsedSession && new Date(parsedSession.expiresAt) <= new Date()) {
          console.warn("Session expired. Clearing...");
          localStorage.removeItem("user");
          localStorage.removeItem("session");
          setLoading(false);
          return;
        }

        // VALIDATE: If user is STAFF but missing permissions, clear and force re-login
        if (parsedUser.role === "STAFF" && !parsedUser.permissions) {
          console.warn("Stale session detected - STAFF user missing permissions. Clearing...");
          localStorage.removeItem("user");
          localStorage.removeItem("session");
          setLoading(false);
          return;
        }

        setUser(parsedUser);
        setSession(parsedSession);
      } catch (error) {
        console.error("Failed to parse stored auth data", error);
        localStorage.removeItem("user");
        localStorage.removeItem("session");
      }
    }

    setLoading(false);
  }, []);

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
      console.error("Failed to refresh user:", error);
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
