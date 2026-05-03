"use client";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/providers";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!loading && user?.mustChangePassword) router.replace("/change-password");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50 flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-gray-900 text-white p-4">
        <h1 className="text-sm font-bold">Property Management Portal</h1>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1 rounded-md hover:bg-gray-800">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      
      <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
