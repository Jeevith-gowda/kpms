"use client";
import { useAuth } from "@/components/providers";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-gray-500">Welcome back, {user?.name}.</p>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500">Role</h3>
          <p className="mt-2 text-2xl font-bold text-gray-900 capitalize">{user?.role?.toLowerCase()}</p>
        </div>
      </div>
    </div>
  );
}
