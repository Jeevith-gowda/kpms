"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./ui/toast";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: SessionUser | null;
  permissions: string[];
  loading: boolean;
  refresh: () => void;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  permissions: [],
  loading: true,
  refresh: () => {},
  hasPermission: () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchMe() {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPermissions(data.permissions);
      } else {
        setUser(null);
        setPermissions([]);
      }
    } catch {
      setUser(null);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchMe(); }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        refresh: fetchMe,
        hasPermission: (key) => permissions.includes(key),
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}
