import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/store/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-sieg-ink" />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
